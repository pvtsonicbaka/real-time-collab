import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import * as Y from "yjs";
import { Document } from "../models/Document";
import { User } from "../models/User";
import mongoose from "mongoose";
import { queueEmail } from "../queues/emailQueue";
import { accessRequestEmail, accessApprovedEmail } from "../utils/emailTemplates";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const docs = new Map<string, Y.Doc>();
let _io: Server;

const slog = (s: string) => String(s).replace(/[\r\n]/g, " ").slice(0, 100);

export const getIO = () => _io;
export const resetYDoc = (documentId: string) => docs.delete(documentId);
export const setYDoc = (documentId: string, ydoc: Y.Doc) => docs.set(documentId, ydoc);

export const setupSocket = (io: Server) => {
  _io = io;

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
    console.log(`User connected: ${slog(socket.data.user)}`);

    let currentDocumentId: string | null = null;

    socket.on("join-document", async (documentId: string) => {
      const doc = await Document.findById(documentId);
      if (!doc) return;

      const userId = socket.data.user;
      const isOwner = doc.owner.toString() === userId;
      const collab = doc.collaborators.find((c: any) => c.userId.toString() === userId);

      if (!isOwner && !collab) {
        socket.emit("join-rejected");
        return;
      }

      // store role so yjs-update can enforce it
      socket.data.role = isOwner ? "owner" : (collab ? collab.role : "viewer");
      currentDocumentId = documentId;
      socket.join(documentId);
      console.log(`User ${slog(userId)} joined ${slog(documentId)} as ${slog(socket.data.role)}`);

      const isNewDoc = !docs.has(documentId);
      if (isNewDoc) {
        const ydoc = new Y.Doc();
        docs.set(documentId, ydoc);
        // always send HTML content — client loads it into their ydoc
        socket.emit("load-content", doc.content);
      } else {
        const ydoc = docs.get(documentId)!;
        socket.emit("yjs-sync", Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64"));
      }

      // send existing online members to the new joiner
      const roomSockets = await io.in(documentId).fetchSockets();
      for (const s of roomSockets) {
        if (s.id === socket.id || !s.data.name) continue;
        socket.emit("user-joined", {
          socketId: s.id,
          userId: s.data.user,
          name: s.data.name,
          color: s.data.color || "#6366f1",
        });
      }
    });

    socket.on("user-presence", ({ documentId, name, color }: {
      documentId: string; name: string; color: string;
    }) => {
      socket.data.name = name;
      socket.data.color = color;
      socket.to(documentId).emit("user-joined", {
        socketId: socket.id,
        userId: socket.data.user,
        name,
        color,
        role: socket.data.role,
      });
    });

    socket.on("kick-user", ({ targetSocketId, documentId }: { targetSocketId: string; documentId: string }) => {
      // only the document owner can kick
      if (socket.data.role !== "owner") return;
      // ensure kicker is actually in the same room as the target
      if (!currentDocumentId || currentDocumentId !== documentId) return;
      io.to(targetSocketId).emit("kicked");
    });

    // pending user requests access with desired role
    socket.on("request-access", ({ documentId, name, color, role }: {
      documentId: string; name: string; color: string; role: "editor" | "viewer";
    }) => {
      socket.data.name = name;
      socket.data.color = color;
      io.to(documentId).emit("access-request", {
        socketId: socket.id,
        userId: socket.data.user,
        name,
        color,
        role,
        documentId,
      });

      // email the document owner (skip guest accounts)
      Document.findById(documentId).then(async doc => {
        if (!doc) return;
        const owner = await User.findById(doc.owner).select("name email isGuest");
        if (!owner?.email || owner.isGuest) return;
        const { subject, html } = accessRequestEmail({
          ownerName: owner.name,
          requesterName: name,
          docTitle: doc.title,
          role,
          docUrl: `${CLIENT_URL}/editor/${documentId}`,
        });
        await queueEmail({ to: owner.email, subject, html });
      }).catch(() => {});
    });

    // approve — save with role to DB
    socket.on("approve-access", async ({ requesterSocketId, documentId, userId, role }: {
      requesterSocketId: string; documentId: string; userId: string; role: "editor" | "viewer";
    }) => {
      const resolvedRole = role || "editor";
      const objectId = new mongoose.Types.ObjectId(userId);

      const doc = await Document.findById(documentId);
      if (!doc) return;

      const existing = doc.collaborators.find((c: any) => c.userId.toString() === userId);
      if (existing) {
        // already whitelisted — just update role, no duplicate
        await Document.findOneAndUpdate(
          { _id: documentId, "collaborators.userId": objectId },
          { $set: { "collaborators.$.role": resolvedRole } }
        );
      } else {
        await Document.findByIdAndUpdate(documentId, {
          $push: { collaborators: { userId: objectId, role: resolvedRole } },
        });
      }

      const ydoc = docs.get(documentId);
      if (!ydoc) return;
      io.to(requesterSocketId).emit("access-approved", {
        state: Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64"),
        role: resolvedRole,
      });

      // email the requester (skip guest accounts)
      Document.findById(documentId).then(async doc => {
        if (!doc) return;
        const [requester, owner] = await Promise.all([
          User.findById(userId).select("name email isGuest"),
          User.findById(doc.owner).select("name"),
        ]);
        if (!requester?.email || (requester as any).isGuest) return;
        const { subject, html } = accessApprovedEmail({
          userName: requester.name,
          ownerName: owner?.name || "The owner",
          docTitle: doc.title,
          role: resolvedRole,
          docUrl: `${CLIENT_URL}/editor/${documentId}`,
        });
        await queueEmail({ to: requester.email, subject, html });
      }).catch(() => {});
    });

    socket.on("deny-access", ({ requesterSocketId }: { requesterSocketId: string }) => {
      io.to(requesterSocketId).emit("access-denied");
    });

    // only editors/owners can push yjs updates
    socket.on("yjs-update", ({ documentId, update }: { documentId: string; update: string }) => {
      if (socket.data.role === "viewer") return;
      const ydoc = docs.get(documentId);
      if (!ydoc) return;
      Y.applyUpdate(ydoc, Buffer.from(update, "base64"));
      socket.to(documentId).emit("yjs-update", update);
    });

    // owner replaces server ydoc after restore
    socket.on("yjs-replace", ({ documentId, state }: { documentId: string; state: string }) => {
      if (socket.data.role !== "owner") return;
      const freshYdoc = new Y.Doc();
      Y.applyUpdate(freshYdoc, Buffer.from(state, "base64"));
      docs.set(documentId, freshYdoc);
      // broadcast full replacement state to everyone else in the room
      socket.to(documentId).emit("yjs-replace", state);
    });

    socket.on("cursor-move", ({ documentId, position, name, color }: {
      documentId: string; position: number; name: string; color: string;
    }) => {
      socket.to(documentId).emit("cursor-update", {
        socketId: socket.id,
        userId: socket.data.user,
        position,
        name,
        color,
        role: socket.data.role,
      });
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${slog(socket.data.user)}`);
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
