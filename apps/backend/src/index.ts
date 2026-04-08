import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import authRoutes from "./routes/auth";
import documentRoutes from "./routes/document";
import { connectRedis } from "./config/redis";
import http from "http";
import { setupSocket } from "./sockets/socket";
import { Server } from "socket.io";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import cookieParser from "cookie-parser";
import cors from "cors";

dotenv.config();

const app = express();

connectDB(); // 👈 THIS IS IMPORTANT
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes); // THIS LINE
app.use("/api/documents", documentRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

connectRedis();

app.get("/test", (req, res) => {
  res.send("Server running 🚀");
});

const server = http.createServer(app); // wraps express
// socket server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});
setupSocket(io);


server.listen(5000, () => {
  console.log("Server running on port 5000");
});
