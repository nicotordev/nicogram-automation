import cors from "cors";
import express from "express";
import * as fs from "fs";
import { createServer } from "http";
import path from "path";
import process from "process";
import { Server } from "socket.io";
import syncProfile from "../actions/syncProfile.js";
import unfollowNonFollowers from "../actions/unfollowNonFollowers.js";
import { Database } from "../core/db.js";
import { eventBus, eventHistory } from "../core/eventBus.js";

const app = express();
app.use(cors());

// Serve static files from the React app
const clientBuildPath = path.join(process.cwd(), "../frontend/dist");
// Ensure dist exists or serve a placeholder?
// If dev, we might not have dist yet.
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow dev server
  },
});

// Subscribe to eventBus to forward events to Socket.IO
eventBus.on("new-event", (logEntry) => {
  io.emit(logEntry.event, logEntry.data);
});

let currentAutomationController: AbortController | null = null;
let currentAutomationType: 'sync' | 'unfollow' | null = null;

io.on("connection", (socket) => {
  console.log("UI connected");

  // Send history to the new client
  socket.emit("history", eventHistory);

  socket.emit("status", { message: "Connected. Ready to start." });
  socket.emit("sync-state", currentAutomationType === 'sync');
  socket.emit("unfollow-state", currentAutomationType === 'unfollow');

  socket.on("get-favorites", async () => {
    try {
      const db = new Database();
      const favorites = await db.getFavorites();
      socket.emit("favorites", favorites);
    } catch (e) {
      socket.emit("error", { message: "Failed to fetch favorites" });
    }
  });

  socket.on("get-detailed-stats", async (username: string) => {
    try {
      const db = new Database();
      const stats = await db.getDetailedStats(username);
      if (stats) {
        socket.emit("detailed-stats", stats);
      } else {
        // Send empty structure if no data
        socket.emit("detailed-stats", { followers: [], following: [], nonFollowers: [], fans: [] });
      }
    } catch (e) {
      console.error("Failed to get detailed stats:", e);
      socket.emit("error", { message: "Failed to fetch detailed stats" });
    }
  });

  socket.on("get-non-followers", async (username?: string) => {
    try {
      const db = new Database();
      const scan = await db.getLatestScan(username);
      if (!scan) {
        socket.emit("non-followers-list", []);
        return;
      }
      const favorites = new Set(await db.getFavorites());
      const followers = new Set(scan.followers);
      // Non-followers: People I follow who don't follow me
      const nonFollowers = scan.following.filter(u => !followers.has(u));
      
      const list = nonFollowers.map(username => ({
        username,
        isFavorite: favorites.has(username)
      }));
      
      socket.emit("non-followers-list", list);
    } catch (e) {
      socket.emit("error", { message: "Failed to fetch non-followers" });
    }
  });

  socket.on("get-latest-stats", async (username?: string) => {
    try {
      const db = new Database();
      // If username is provided, get stats for that user. Otherwise get latest globally.
      const stats = await db.getLatestProfileStats(username);
      if (stats) {
        // Emit as 'data' event which populates the stats in UI
        socket.emit("data", { 
          username: stats.username,
          followersCount: stats.followersCount,
          followingCount: stats.followingCount,
          userId: stats.userId,
          message: "Loaded stored profile data"
        });
      } else {
         // User not found in DB
         socket.emit("profile-not-found", { username });
      }
    } catch (e) {
      // ignore or log
      console.error("Failed to load latest stats", e);
    }
  });

  socket.on("toggle-favorite", async (username: string) => {
    try {
      const db = new Database();
      const isFav = await db.isFavorite(username);
      if (isFav) {
        await db.removeFavorite(username);
      } else {
        await db.addFavorite(username);
      }
      // Emit updated list
      const favorites = await db.getFavorites();
      socket.emit("favorites", favorites);
      
      // Also refresh non-followers list if that view is open, as favorite status changed
      // Ideally we'd broadcast this, but for now client can re-fetch or we emit
      // We can emit the updated favorite status for this user? 
      // Simplest is to emit events that trigger refresh or let client handle it.
      // But let's just re-run the non-followers logic to be sure
      // (This is a bit duplicate but ensures consistency)
      // Actually, let's just let the client request update or update local state.
    } catch (e) {
      socket.emit("error", { message: "Failed to toggle favorite" });
    }
  });

  socket.on("start-sync", async () => {
    if (currentAutomationController) {
      console.log("Cancelling previous automation...");
      currentAutomationController.abort();
    }
    
    currentAutomationController = new AbortController();
    currentAutomationType = 'sync';
    
    console.log("Starting syncing via UI request");
    socket.emit("status", { message: "Syncing starting..." });
    io.emit("sync-state", true); // Broadcast to all clients
    
    try {
      await syncProfile(currentAutomationController.signal);
    } catch (e) {
      console.error("Syncing failed to start/finish:", e);
    } finally {
      if (currentAutomationType === 'sync') {
        currentAutomationController = null;
        currentAutomationType = null;
        io.emit("sync-state", false);
      }
    }
  });

  socket.on("start-unfollow", async () => {
    if (currentAutomationController) {
      console.log("Cancelling previous automation...");
      currentAutomationController.abort();
    }

    currentAutomationController = new AbortController();
    currentAutomationType = 'unfollow';

    console.log("Starting unfollow automation via UI request");
    socket.emit("status", { message: "Unfollow automation starting..." });
    io.emit("unfollow-state", true);

    try {
      await unfollowNonFollowers(currentAutomationController.signal);
    } catch (e) {
      console.error("Unfollow automation failed:", e);
    } finally {
      if (currentAutomationType === 'unfollow') {
        currentAutomationController = null;
        currentAutomationType = null;
        io.emit("unfollow-state", false);
      }
    }
  });

  const handleCancel = () => {
    if (currentAutomationController) {
      console.log("Cancellation requested via UI");
      currentAutomationController.abort();
      socket.emit("status", { message: "Cancellation requested..." });
    }
  };

  socket.on("cancel-sync", handleCancel);
  socket.on("cancel-unfollow", handleCancel);
});

export function startServer(port = 3000) {
  httpServer.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

// API Routes
app.get("/api/scans", async (_req, res) => {
  try {
    const db = new Database();
    const scans = await db.getScans();
    res.json(scans);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch scans" });
  }
});

app.get('/api/profile', async (req, res) => {
  try {
    const username = req.query.username as string;
    if (!username) {
      res.status(400).json({ error: "Username is required" });
      return;
    }
    const db = new Database();
    const profile = await db.getProfile(username);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Handle all other requests by returning the React app
app.get(/.*/, (_req, res) => {
  if (fs.existsSync(path.join(clientBuildPath, "index.html"))) {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  } else {
    res.send("UI not built. Please run `bun run dev:frontend` or build the frontend.");
  }
});
