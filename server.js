import "dotenv/config"; // ES Module way to load environment variables
import express from "express";
import cors from "cors"; // RE-ADDED CORS
import { prisma } from "./config/db.js"; // Note the .js extension for local imports
import authRoutes from "./routes/auth.js"; // Note the .js extension
import profile from "./routes/profile.js";
import follow from "./routes/follow.js";
import avatar from "./routes/avatar.js";
import search from "./routes/search.js";
import feed from "./routes/feed.js";
import post from "./routes/postcreate.js";
import like from "./routes/likes.js";
import savepost from "./routes/savedpost.js";
import comment from "./routes/comments.js";
import chat from "./routes/chat.js";
import path from "path";
import socketHandler from "./ socket/socketHandler.js"; // Fixed: removed space in path
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import http from "http";
const app = express();

// Create HTTP server first, then create Socket.IO server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Allow requests from your React development server
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json()); // Allows us to get data in req.body
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  cors({
    origin: "http://localhost:5173", // Allow requests from your React development server
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], // Allowed HTTP methods
    credentials: true, // Allow cookies and authorization headers
  }),
);

// --- ADDED GENERAL REQUEST LOGGER ---
app.use((req, res, next) => {
  console.log(`Incoming Request: ${req.method} ${req.url}`);

  if (Object.keys(req.query || {}).length > 0) {
    console.log("Query Params:", req.query);
  }

  // Fix this block to avoid calling Object.keys on undefined
  if (req.method !== "GET" && req.body && typeof req.body === "object") {
    const keys = Object.keys(req.body);
    if (keys.length > 0) {
      console.log("Request Body:", req.body);
    }
  }
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profile);
app.use("/api/profile", follow);
app.use("/api/profile", avatar);
app.use("/api/profile", search);
app.use("/api/posts", feed);
app.use("/api/posts", post);
app.use("/api/posts", like);
app.use("/api/posts", savepost);
app.use("/api/posts", comment);
app.use("/api/chat", chat);

// Basic unprotected route for testing
app.get("/", (req, res) => {
  res.send("Auth Backend with Socket.IO Chat is running!");
});

// Initialize Socket.IO handlers
socketHandler(io);

// Error handling middleware
app.use((err, res) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const PORT = process.env.PORT || 4000;

// Use server.listen instead of app.listen to support Socket.IO
server.listen(PORT, async () => {
  try {
    await prisma.$connect(); // Connect to the database when server starts
    console.log("Prisma connected to database!");
    console.log(`Server running on port ${PORT}`);
    console.log("Socket.IO chat server initialized!");
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1); // Exit if DB connection fails
  }
});

// Disconnect Prisma client when the application closes
process.on("beforeExit", async () => {
  await prisma.$disconnect();
  console.log("Prisma disconnected from database");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  await prisma.$disconnect();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  await prisma.$disconnect();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
