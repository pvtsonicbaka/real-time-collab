import express, { Router } from "express";
import { Document } from "../models/Document";
import { User } from "../models/User";
import { protect } from "../middleware/auth";
import { isOwner } from "../middleware/ownership";
import { getIO } from "../sockets/socket";
import { Version } from "../models/Version";
import { pruneVersions } from "./version";
import versionRoutes from "./version";
import commentRoutes from "./comment";
import jwt from "jsonwebtoken";
import { queueEmail } from "../queues/emailQueue";
import { inviteEmail } from "../utils/emailTemplates";
import { sanitizeText, sanitizeContent } from "../utils/sanitize";

const AUTO_SNAPSHOT_INTERVAL_MS = 30_000;

const router: Router = express.Router();

// helper — get user's role in a doc
// userId field may be populated (object) or raw ObjectId after populate()
const getUserRole = (doc: any, userId: string): "owner" | "editor" | "viewer" | null => {
  if (doc.owner.toString() === userId) return "owner";
  const collab = doc.collaborators.find((c: any) => {
    const id = c.userId?._id ?? c.userId;
    return id.toString() === userId;
  });
  return collab ? collab.role : null;
};

// CREATE
router.post("/", protect, async (req: any, res) => {
  try {
    const { title, content } = req.body;
    const cleanTitle = sanitizeText(title || "");
    if (!cleanTitle) return res.status(400).json({ message: "Title is required" });
    const doc = await Document.create({ title: cleanTitle, content: sanitizeContent(content || ""), owner: req.user });
    res.status(201).json(doc);
  } catch {
    res.status(500).json({ message: "Error creating document" });
  }
});

// GET BY ID
router.get("/:id", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate("collaborators.userId", "name email");

    if (!doc) return res.status(404).json({ message: "Not found" });

    const role = getUserRole(doc, req.user);
    if (!role) return res.status(403).json({ message: "Not allowed" });

    res.json({ ...doc.toObject(), isOwner: role === "owner", myRole: role });
  } catch {
    res.status(500).json({ message: "Error fetching document" });
  }
});

// GET ALL
router.get("/", protect, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim();

    const base = {
      $or: [
        { owner: req.user },
        { "collaborators.userId": req.user },
      ],
    };

    const filter = search
      ? { ...base, $text: { $search: search } }
      : base;

    const [docs, total] = await Promise.all([
      Document.find(filter)
        .sort(search ? { score: { $meta: "textScore" } } : { updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Document.countDocuments(filter),
    ]);

    res.json({ docs, total, page, hasMore: skip + docs.length < total });
  } catch {
    res.status(500).json({ message: "Error fetching documents" });
  }
});

// UPDATE — only owner or editor
router.put("/:id", protect, async (req: any, res) => {
  try {
    const { content } = req.body;
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const role = getUserRole(doc, req.user);
    if (!role || role === "viewer") return res.status(403).json({ message: "Not allowed" });

    const cleanContent = sanitizeContent(content || "");

    // auto-snapshot: only owner triggers it
    const isDocOwner = doc.owner.toString() === req.user;
    if (isDocOwner) {
      const lastSnapshot = await Version.findOne({ documentId: doc._id }).sort({ createdAt: -1 });
      const timeSinceLast = lastSnapshot ? Date.now() - lastSnapshot.createdAt.getTime() : Infinity;
      if (timeSinceLast >= AUTO_SNAPSHOT_INTERVAL_MS && cleanContent !== doc.content) {
        await pruneVersions(String(doc._id));
        await Version.create({ documentId: doc._id, content: doc.content, savedBy: req.user, label: "", isManual: false });
      }
    }

    doc.content = cleanContent;
    await doc.save();
    res.json(doc);
  } catch {
    res.status(500).json({ message: "Error updating document" });
  }
});

// DELETE — owner only
router.delete("/:id", protect, isOwner, async (req: any, res) => {
  try {
    await req.doc.deleteOne();
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Error deleting document" });
  }
});

// ADD COLLABORATOR with role
router.post("/:id/collaborator", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (doc.owner.toString() !== req.user) return res.status(403).json({ message: "Only owner can add" });

    const { userId, role = "editor" } = req.body;
    const exists = doc.collaborators.find((c: any) => c.userId.toString() === userId);
    if (exists) return res.status(400).json({ message: "Already a collaborator" });

    doc.collaborators.push({ userId, role } as any);
    await doc.save();

    const updated = await Document.findById(doc._id).populate("collaborators.userId", "name email");
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Error adding collaborator" });
  }
});

// UPDATE COLLABORATOR ROLE
router.patch("/:id/collaborator/:userId", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (doc.owner.toString() !== req.user) return res.status(403).json({ message: "Only owner can change roles" });

    const { role } = req.body;
    const collab = doc.collaborators.find((c: any) => c.userId.toString() === req.params.userId);
    if (!collab) return res.status(404).json({ message: "Collaborator not found" });

    (collab as any).role = role;
    await doc.save();

    // notify the affected user via socket
    try {
      const io = getIO();
      io.to(req.params.id).emit("role-changed", {
        userId: req.params.userId,
        role,
      });
    } catch {}

    const updated = await Document.findById(doc._id).populate("collaborators.userId", "name email");
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Error updating role" });
  }
});
// REMOVE COLLABORATOR
router.delete("/:id/collaborator/:userId", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (doc.owner.toString() !== req.user) return res.status(403).json({ message: "Only owner can remove" });

    doc.collaborators = doc.collaborators.filter((c: any) => c.userId.toString() !== req.params.userId) as any;
    await doc.save();

    const updated = await Document.findById(doc._id).populate("collaborators.userId", "name email");
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Error removing collaborator" });
  }
});

// mount version routes
router.use("/:id/versions", versionRoutes);
router.use("/:id/comments", commentRoutes);

// SEND INVITE
router.post("/:id/invite", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (doc.owner.toString() !== req.user) return res.status(403).json({ message: "Only owner can invite" });

    const { email, role = "editor" } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    if (email.endsWith("@guest.collabdocs.dev")) return res.status(400).json({ message: "Cannot invite a guest account" });

    const invitee = await User.findOne({ email });
    const owner = await User.findById(req.user).select("name isGuest");
    if ((owner as any)?.isGuest) return res.status(403).json({ message: "Guest accounts cannot send invites" });

    const token = jwt.sign(
      { docId: req.params.id, email, role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const inviteUrl = `${process.env.CLIENT_URL}/invite?token=${token}`;
    const { subject, html } = inviteEmail({
      inviteeName: invitee?.name || email,
      ownerName: owner?.name || "Someone",
      docTitle: doc.title,
      role,
      inviteUrl,
    });

    await queueEmail({ to: email, subject, html });
    res.json({ message: "Invite sent" });
  } catch {
    res.status(500).json({ message: "Error sending invite" });
  }
});

// ACCEPT INVITE
router.post("/invite/accept", protect, async (req: any, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token required" });

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { docId, email, role } = payload;

    // make sure the logged-in user matches the invite email
    const user = await User.findById(req.user).select("email");
    if (user?.email !== email) return res.status(403).json({ message: "This invite is not for you" });

    const doc = await Document.findById(docId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // already owner
    if (doc.owner.toString() === req.user) return res.json({ message: "You are the owner", docId });

    const exists = doc.collaborators.find((c: any) => c.userId.toString() === req.user);
    if (!exists) {
      doc.collaborators.push({ userId: req.user, role } as any);
      await doc.save();
    }

    res.json({ message: "Invite accepted", docId, role });
  } catch (err: any) {
    if (err.name === "TokenExpiredError") return res.status(400).json({ message: "Invite link has expired" });
    res.status(400).json({ message: "Invalid invite token" });
  }
});

export default router;
