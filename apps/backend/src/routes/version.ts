import express, { Router } from "express";
import * as Y from "yjs";
import { Version } from "../models/Version";
import { Document } from "../models/Document";
import { protect } from "../middleware/auth";
import { getIO } from "../sockets/socket";

const router: Router = express.Router({ mergeParams: true });

const MAX_VERSIONS = 50;

const getUserRole = (doc: any, userId: string) => {
  if (doc.owner.toString() === userId) return "owner";
  const collab = doc.collaborators.find((c: any) => {
    const id = c.userId?._id ?? c.userId;
    return id.toString() === userId;
  });
  return collab ? collab.role : null;
};

// LIST versions for a document (all roles)
router.get("/", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (!getUserRole(doc, req.user)) return res.status(403).json({ message: "Not allowed" });

    const versions = await Version.find({ documentId: req.params.id })
      .populate("savedBy", "name")
      .sort({ createdAt: -1 })
      .limit(MAX_VERSIONS);

    res.json(versions);
  } catch {
    res.status(500).json({ message: "Error fetching versions" });
  }
});

// GET single version content (all roles)
router.get("/:vId", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (!getUserRole(doc, req.user)) return res.status(403).json({ message: "Not allowed" });

    const version = await Version.findById(req.params.vId).populate("savedBy", "name");
    if (!version) return res.status(404).json({ message: "Version not found" });

    res.json(version);
  } catch {
    res.status(500).json({ message: "Error fetching version" });
  }
});

// MANUAL save point (owner + editor only)
router.post("/", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const role = getUserRole(doc, req.user);
    if (!role || role === "viewer") return res.status(403).json({ message: "Not allowed" });

    const { label } = req.body;

    await pruneVersions(req.params.id);

    const version = await Version.create({
      documentId: req.params.id,
      content: doc.content,
      savedBy: req.user,
      label: label || "Manual save",
      isManual: true,
    });

    const populated = await version.populate("savedBy", "name");
    res.status(201).json(populated);
  } catch {
    res.status(500).json({ message: "Error saving version" });
  }
});

// RESTORE a version (owner only)
router.post("/:vId/restore", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (doc.owner.toString() !== req.user) return res.status(403).json({ message: "Only owner can restore" });

    const version = await Version.findById(req.params.vId);
    if (!version) return res.status(404).json({ message: "Version not found" });

    // snapshot current content before restoring
    await pruneVersions(req.params.id);
    await Version.create({
      documentId: req.params.id,
      content: doc.content,
      savedBy: req.user,
      label: "Before restore",
      isManual: false,
    });

    doc.content = version.content;
    await doc.save();

    try {
      const io = getIO();
      io.to(req.params.id).emit("doc-evicted", { message: "Document was restored to a previous version. Please rejoin." });
      io.to(req.params.id).emit("doc-restored", { content: version.content, ownerUserId: req.user });
    } catch {}

    res.json({ message: "Restored", content: version.content });
  } catch {
    res.status(500).json({ message: "Error restoring version" });
  }
});

// helper — drop oldest versions if over limit
export async function pruneVersions(documentId: string) {
  const count = await Version.countDocuments({ documentId });
  if (count >= MAX_VERSIONS) {
    const oldest = await Version.find({ documentId })
      .sort({ createdAt: 1 })
      .limit(count - MAX_VERSIONS + 1)
      .select("_id");
    await Version.deleteMany({ _id: { $in: oldest.map((v) => v._id) } });
  }
}

export default router;
