import express, { Router } from "express";
import { Comment } from "../models/Comment";
import { Document } from "../models/Document";
import { User } from "../models/User";
import { protect } from "../middleware/auth";
import { getIO } from "../sockets/socket";
import { queueEmail } from "../queues/emailQueue";
import { commentEmail } from "../utils/emailTemplates";
import { sanitizeText } from "../utils/sanitize";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const router: Router = express.Router({ mergeParams: true });

const getUserRole = (doc: any, userId: string) => {
  if (doc.owner.toString() === userId) return "owner";
  const collab = doc.collaborators.find((c: any) => {
    const id = c.userId?._id ?? c.userId;
    return id.toString() === userId;
  });
  return collab ? collab.role : null;
};

const populate = (q: any) =>
  q.populate("authorId", "name").populate("replies.authorId", "name");

const broadcast = (documentId: string, event: string, data: any) => {
  try { getIO().to(documentId).emit(event, data); } catch {}
};

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Inline threaded comments on documents
 */

/**
 * @swagger
 * /api/documents/{id}/comments:
 *   get:
 *     summary: List all comments for a document
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Comment' }
 *       403: { description: Not allowed }
 *       404: { description: Document not found }
 */
// GET all comments for a doc
router.get("/", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (!getUserRole(doc, req.user)) return res.status(403).json({ message: "Not allowed" });

    const comments = await populate(
      Comment.find({ documentId: req.params.id }).sort({ createdAt: -1 })
    );
    res.json(comments);
  } catch {
    res.status(500).json({ message: "Error fetching comments" });
  }
});

/**
 * @swagger
 * /api/documents/{id}/comments:
 *   post:
 *     summary: Add a comment to a document
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string, example: "Great point!" }
 *               anchorText: { type: string, example: "selected text" }
 *               color: { type: string, example: "#6366f1" }
 *     responses:
 *       201:
 *         description: Comment created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Comment' }
 *       403: { description: Viewers cannot comment }
 */
// POST create comment (owner + editor only)
router.post("/", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    const role = getUserRole(doc, req.user);
    if (!role || role === "viewer") return res.status(403).json({ message: "Not allowed" });

    const { body, anchorText = "", yRelativeFrom = "", yRelativeTo = "", color = "#6366f1" } = req.body;
    const cleanBody = sanitizeText(body || "");
    if (!cleanBody) return res.status(400).json({ message: "Body required" });

    const comment = await Comment.create({
      documentId: req.params.id,
      authorId: req.user,
      body: cleanBody,
      anchorText: sanitizeText(anchorText),
      yRelativeFrom,
      yRelativeTo,
      color,
    });
    const populated = await populate(Comment.findById(comment._id));
    res.status(201).json(populated);
    broadcast(req.params.id, "comment-added", populated);

    // email owner if commenter is not the owner (skip guest accounts)
    if (doc.owner.toString() !== req.user) {
      const [owner, commenter] = await Promise.all([
        User.findById(doc.owner).select("name email isGuest"),
        User.findById(req.user).select("name"),
      ]);
      if (owner?.email && !owner.isGuest) {
        const { subject, html } = commentEmail({
          ownerName: owner.name,
          commenterName: commenter?.name || "Someone",
          docTitle: doc.title,
          commentBody: body.trim().slice(0, 200),
          docUrl: `${CLIENT_URL}/editor/${req.params.id}`,
        });
        await queueEmail({ to: owner.email, subject, html });
      }
    }
  } catch {
    res.status(500).json({ message: "Error creating comment" });
  }
});
/**
 * @swagger
 * /api/documents/{id}/comments/{cId}/reply:
 *   post:
 *     summary: Reply to a comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: cId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string, example: "I agree!" }
 *     responses:
 *       200:
 *         description: Updated comment with reply
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Comment' }
 */
router.post("/:cId/reply", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    const role = getUserRole(doc, req.user);
    if (!role || role === "viewer") return res.status(403).json({ message: "Not allowed" });

    const { body } = req.body;
    const cleanBody = sanitizeText(body || "");
    if (!cleanBody) return res.status(400).json({ message: "Body required" });

    const comment = await Comment.findById(req.params.cId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.replies.push({ authorId: req.user, body: cleanBody } as any);
    await comment.save();

    const populated = await populate(Comment.findById(comment._id));
    res.json(populated);
    broadcast(req.params.id, "comment-updated", populated);
  } catch {
    res.status(500).json({ message: "Error adding reply" });
  }
});

/**
 * @swagger
 * /api/documents/{id}/comments/{cId}/resolve:
 *   patch:
 *     summary: Resolve a comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: cId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Comment resolved
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Comment' }
 */
// PATCH resolve
router.patch("/:cId/resolve", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const comment = await Comment.findById(req.params.cId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const role = getUserRole(doc, req.user);
    const isAuthor = comment.authorId.toString() === req.user;
    if (!isAuthor && role !== "owner") return res.status(403).json({ message: "Not allowed" });

    comment.resolved = true;
    comment.resolvedBy = req.user;
    await comment.save();

    const populated = await populate(Comment.findById(comment._id));
    res.json(populated);
    broadcast(req.params.id, "comment-updated", populated);
  } catch {
    res.status(500).json({ message: "Error resolving comment" });
  }
});

/**
 * @swagger
 * /api/documents/{id}/comments/{cId}/reopen:
 *   patch:
 *     summary: Reopen a resolved comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: cId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Comment reopened
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Comment' }
 */
// PATCH reopen
router.patch("/:cId/reopen", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const comment = await Comment.findById(req.params.cId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const role = getUserRole(doc, req.user);
    const isAuthor = comment.authorId.toString() === req.user;
    if (!isAuthor && role !== "owner") return res.status(403).json({ message: "Not allowed" });

    comment.resolved = false;
    comment.resolvedBy = undefined as any;
    await comment.save();

    const populated = await populate(Comment.findById(comment._id));
    res.json(populated);
    broadcast(req.params.id, "comment-updated", populated);
  } catch {
    res.status(500).json({ message: "Error reopening comment" });
  }
});

/**
 * @swagger
 * /api/documents/{id}/comments/{cId}:
 *   delete:
 *     summary: Delete a comment (owner or author only)
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: cId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Comment deleted }
 *       403: { description: Not allowed }
 */
// DELETE comment
router.delete("/:cId", protect, async (req: any, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const comment = await Comment.findById(req.params.cId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const role = getUserRole(doc, req.user);
    const isAuthor = comment.authorId.toString() === req.user;
    if (!isAuthor && role !== "owner") return res.status(403).json({ message: "Not allowed" });

    await comment.deleteOne();
    res.json({ message: "Deleted", commentId: req.params.cId });
    broadcast(req.params.id, "comment-deleted", { commentId: req.params.cId });
  } catch {
    res.status(500).json({ message: "Error deleting comment" });
  }
});

export default router;
