import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import * as fs from "fs";
import { JsonDatabase } from "../core/db.js";

const app = express();
app.use(cors());

// Serve static files from the React app
const clientBuildPath = path.join(process.cwd(), "client/dist");
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

export type AutomationCallback = () => Promise<void>;
let automationHandler: AutomationCallback | null = null;

// Store recent events for new clients
const MAX_HISTORY = 50;
const eventHistory: Array<{ event: string; data: any; timestamp: string }> = [];

export function registerAutomationHandler(handler: AutomationCallback) {
  automationHandler = handler;
}

io.on("connection", (socket) => {
  console.log("UI connected");
  
  // Send history to the new client
  socket.emit("history", eventHistory);
  
  socket.emit("status", { message: "Connected. Ready to start." });

  socket.on("start-automation", async () => {
    if (automationHandler) {
      console.log("Starting automation via UI request");
      socket.emit("status", { message: "Automation starting..." });
      try {
        await automationHandler();
        // socket.emit("status", { message: "Automation finished." }); // Handled in automation
      } catch (e) {
         // handled elsewhere
      }
    } else {
        socket.emit("error", { message: "No automation handler registered." });
    }
  });
});

// Helper to broadcast events
export function broadcast(event: string, data: any) {
  const timestamp = new Date().toISOString();
  // Store in history
  eventHistory.push({ event, data, timestamp });
  if (eventHistory.length > MAX_HISTORY) {
    eventHistory.shift();
  }
  
  io.emit(event, data);
}

export function startServer(port = 3000) {
  httpServer.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

// API Routes
app.get("/api/scans", (req, res) => {
  try {
    const db = new JsonDatabase(process.cwd());
    res.json(db.getScans());
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch scans" });
  }
});

// Handle all other requests by returning the React app
app.get(/.*/, (req, res) => {
   if (fs.existsSync(path.join(clientBuildPath, "index.html"))) {
      res.sendFile(path.join(clientBuildPath, "index.html"));
   } else {
     res.send("UI not built. Please run `cd client && npm run build` or use the dev server.");
   }
});
