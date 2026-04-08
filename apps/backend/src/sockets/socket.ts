import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import * as Y from "yjs";
import { Document } from "../models/Document";

const docs = new Map<string, Y.Doc>();

export const setupSocket = (io: Server) => {

  // 🔐 AUTH MIDDLEWARE
  io.use((socket: Socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || "";
      const accessToken = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("accessToken="))
        ?.split("=")[1];

      if (!accessToken) return next(new Error("No token"));

      const decoded: any = jwt.verify(accessToken, process.env.JWT_SECRET!);
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
    socket.on("join-document", async (documentId: string) => {
      socket.join(documentId);
      console.log(`User ${socket.data.user} joined ${documentId}`);

      const isNewDoc = !docs.has(documentId);

      if (isNewDoc) {
        docs.set(documentId, new Y.Doc());
        const dbDoc = await Document.findById(documentId);
        if (dbDoc?.content) {
          socket.emit("load-content", dbDoc.content);
        } else {
          socket.emit("yjs-sync", Buffer.from(Y.encodeStateAsUpdate(docs.get(documentId)!)).toString("base64"));
        }
      } else {
        const ydoc = docs.get(documentId)!;
        socket.emit("yjs-sync", Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64"));
      }
    });

    // 🔄 YJS UPDATE
    socket.on("yjs-update", ({ documentId, update }: { documentId: string; update: string }) => {
      const ydoc = docs.get(documentId);
      if (!ydoc) return;
      const uint8 = Buffer.from(update, "base64");
      Y.applyUpdate(ydoc, uint8);
      socket.to(documentId).emit("yjs-update", update);
    });

    // ❌ DISCONNECT
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.data.user);
    });
  });
};
