import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import * as Y from "yjs";
import { Document } from "../models/Document";

const docs = new Map<string, Y.Doc>();

export const setupSocket = (io: Server) => {

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

  io.on("connection", (socket: Socket) => {
    console.log("User connected:", socket.data.user);

    // track which document this socket is in
    let currentDocumentId: string | null = null;

    socket.on("join-document", async (documentId: string) => {
      currentDocumentId = documentId;
      socket.join(documentId);
      console.log(`User ${socket.data.user} joined ${documentId}`);

      const isNewDoc = !docs.has(documentId);
      if (isNewDoc) {
        const ydoc = new Y.Doc();
        docs.set(documentId, ydoc);
        const dbDoc = await Document.findById(documentId);
        if (dbDoc?.content) {
          socket.emit("load-content", dbDoc.content);
        } else {
          socket.emit("yjs-sync", Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64"));
        }
      } else {
        const ydoc = docs.get(documentId)!;
        socket.emit("yjs-sync", Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64"));
      }

      // ask everyone else in room to re-announce their presence to the new user
      socket.to(documentId).emit("announce-presence", { documentId });
    });

    // broadcast presence — userId is stable key across reconnects
    socket.on("user-presence", ({ documentId, name, color }: {
      documentId: string; name: string; color: string;
    }) => {
      socket.to(documentId).emit("user-joined", {
        socketId: socket.id,
        userId: socket.data.user,
        name,
        color,
      });
    });

    socket.on("kick-user", ({ targetSocketId }: { targetSocketId: string }) => {
      io.to(targetSocketId).emit("kicked");
    });

    socket.on("request-access", ({ documentId, name, color }: {
      documentId: string; name: string; color: string;
    }) => {
      socket.to(documentId).emit("access-request", {
        socketId: socket.id,
        userId: socket.data.user,
        name,
        color,
        documentId,
      });
    });

    socket.on("approve-access", async ({ requesterSocketId, documentId, userId }: {
      requesterSocketId: string; documentId: string; userId: string;
    }) => {
      await Document.findByIdAndUpdate(documentId, {
        $addToSet: { collaborators: userId },
      });
      const ydoc = docs.get(documentId);
      if (!ydoc) return;
      io.to(requesterSocketId).emit("access-approved", {
        state: Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64"),
      });
    });

    socket.on("deny-access", ({ requesterSocketId }: { requesterSocketId: string }) => {
      io.to(requesterSocketId).emit("access-denied");
    });

    socket.on("yjs-update", ({ documentId, update }: { documentId: string; update: string }) => {
      const ydoc = docs.get(documentId);
      if (!ydoc) return;
      Y.applyUpdate(ydoc, Buffer.from(update, "base64"));
      socket.to(documentId).emit("yjs-update", update);
    });

    // userId included so receivers can deduplicate by userId not socketId
    socket.on("cursor-move", ({ documentId, position, name, color }: {
      documentId: string; position: number; name: string; color: string;
    }) => {
      socket.to(documentId).emit("cursor-update", {
        socketId: socket.id,
        userId: socket.data.user,
        position,
        name,
        color,
      });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.data.user);
      if (currentDocumentId) {
        socket.to(currentDocumentId).emit("cursor-remove", {
          socketId: socket.id,
          userId: socket.data.user,
        });
        socket.to(currentDocumentId).emit("user-left", { userId: socket.data.user });
      }
    });
  });
};
