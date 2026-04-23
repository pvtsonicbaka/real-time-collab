import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import { protect } from "./middleware/auth";

import { connectDB } from "./config/db";
import { redisClient, connectRedis } from "./config/redis";
import authRoutes from "./routes/auth";
import documentRoutes from "./routes/document";
import { setupSocket } from "./sockets/socket";
import { swaggerSpec } from "./config/swagger";
import { startEmailWorker } from "./workers/emailWorker";

dotenv.config();

async function boot() {
  // 1. connect DB and Redis first
  await connectDB();
  await connectRedis();

  // 2. create sub client (duplicate of pub client)
  const subClient = redisClient.duplicate();
  await subClient.connect();

  // 3. express app
  const app = express();

  // security headers
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // disabled — frontend handles CSP
  }));

  // strict CORS
  app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/auth", authRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

  app.get("/metrics", protect, async (_req, res) => {
    const mem = process.memoryUsage();
    const [dbStatus, redisStatus] = await Promise.all([
      import("mongoose").then(m => m.default.connection.readyState === 1 ? "connected" : "disconnected"),
      redisClient.ping().then(() => "connected").catch(() => "disconnected"),
    ]);
    res.json({
      status: "ok",
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        heap_used_mb: (mem.heapUsed / 1024 / 1024).toFixed(2),
        heap_total_mb: (mem.heapTotal / 1024 / 1024).toFixed(2),
        rss_mb: (mem.rss / 1024 / 1024).toFixed(2),
      },
      services: {
        mongodb: dbStatus,
        redis: redisStatus,
      },
      socket_rooms: io.sockets.adapter.rooms.size,
      connected_clients: io.sockets.sockets.size,
      node_version: process.version,
      env: process.env.NODE_ENV || "development",
    });
  });

  // 4. socket.io with Redis adapter
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true },
  });

  // pub = redisClient, sub = subClient
  io.adapter(createAdapter(redisClient, subClient));
  console.log("Socket.io Redis adapter attached ✅");

  setupSocket(io);

  // start email worker
  startEmailWorker();

  server.listen(5000, () => console.log("Server running on port 5000 🚀"));
}

boot().catch((err) => {
  console.error("Boot failed:", err);
  process.exit(1);
});
