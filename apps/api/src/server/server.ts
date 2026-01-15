import cors from "cors";
import express from "express";
import * as fs from "fs";
import { createServer } from "http";
import path from "path";
import process from "process";
import { Server } from "socket.io";
import { runAutomation } from "../actions/runAutomation.js";
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

io.on("connection", (socket) => {
  console.log("UI connected");

  // Send history to the new client
  socket.emit("history", eventHistory);

  socket.emit("status", { message: "Connected. Ready to start." });

  socket.on("get-favorites", async () => {
    try {
      const db = new Database();
      const favorites = await db.getFavorites();
      socket.emit("favorites", favorites);
    } catch (e) {
      socket.emit("error", { message: "Failed to fetch favorites" });
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
    } catch (e) {
      socket.emit("error", { message: "Failed to toggle favorite" });
    }
  });

  socket.on("start-automation", async (options: { autoUnfollow?: boolean; } = {}) => {
    console.log("Starting automation via UI request", options);
    socket.emit("status", { message: "Automation starting..." });
    try {
      await runAutomation(options);
    } catch (e) {
      // handled inside runAutomation mostly, but good to have a catch here
      console.error("Automation failed to start/finish:", e);
    }
  });
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
