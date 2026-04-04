import express, { Router } from "express";
import { Document } from "../models/Document";
import { protect } from "../middleware/auth";
import { isOwner } from "../middleware/ownership";

const router: Router = express.Router();

/**
 * @swagger
 * /api/documents:
 *   post:
 *     summary: Create a new document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: My Document
 *     responses:
 *       201:
 *         description: Document created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Error creating document
 */
router.post("/", protect, async (req: any, res) => {
  try {
    const { title } = req.body;

    const doc = await Document.create({
      title,
      owner: req.user,
    });

    res.status(201).json(doc);
  } catch {
    res.status(500).json({ message: "Error creating document" });
  }
});

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: Get all documents for the logged-in user
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Document'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Error fetching documents
 */
router.get("/", protect, async (req: any, res) => {
  try {
    const docs = await Document.find({
      $or: [{ owner: req.user }, { collaborators: req.user }],
    });

    res.json(docs);
  } catch {
    res.status(500).json({ message: "Error fetching documents" });
  }
});

/**
 * @swagger
 * /api/documents/{id}:
 *   put:
 *     summary: Update a document's content
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 example: Updated content here
 *     responses:
 *       200:
 *         description: Document updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not allowed
 *       404:
 *         description: Document not found
 *       500:
 *         description: Error updating document
 */
router.put("/:id", protect, async (req: any, res) => {
  try {
    const { content } = req.body;

    const doc = await Document.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({ message: "Not found" });
    }

    if (
      doc.owner.toString() !== req.user &&
      !doc.collaborators.includes(req.user)
    ) {
      return res.status(403).json({ message: "Not allowed" });
    }

    doc.content = content;
    await doc.save();

    res.json(doc);
  } catch {
    res.status(500).json({ message: "Error updating document" });
  }
});

/**
 * @swagger
 * /api/documents/{id}:
 *   delete:
 *     summary: Delete a document (owner only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized (not the owner)
 *       404:
 *         description: Document not found
 *       500:
 *         description: Error deleting document
 */
router.delete("/:id", protect, isOwner, async (req: any, res) => {
  try {
    await req.doc.deleteOne();

    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Error deleting document" });
  }
});

export default router;
