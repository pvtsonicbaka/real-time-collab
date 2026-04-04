import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";

export const setupSocket = (io: Server) => {

  // 🔐 AUTH MIDDLEWARE
  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("No token"));
      }

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

      socket.data.user = decoded.id;

      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });


  // 🚀 CONNECTION
  io.on("connection", (socket: Socket) => {
    console.log("User connected:", socket.data.user);

    // 🏠 JOIN ROOM
    socket.on("join-document", (documentId: string) => {
      socket.join(documentId);
      console.log(`User ${socket.data.user} joined ${documentId}`);
    });

    // 🔄 SEND CHANGES
    socket.on("send-changes", ({ documentId, content }) => {
      socket.to(documentId).emit("receive-changes", content);
    });

    // ❌ DISCONNECT
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.data.user);
    });
  });
};