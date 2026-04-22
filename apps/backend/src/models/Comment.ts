import mongoose from "mongoose";

const replySchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  body: { type: String, required: true },
}, { timestamps: true });

const commentSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  anchorText: { type: String, default: "" },
  yRelativeFrom: { type: String, default: "" },
  yRelativeTo: { type: String, default: "" },
  pmFrom: { type: Number, default: 0 },
  pmTo: { type: Number, default: 0 },
  color: { type: String, default: "#6366f1" },
  body: { type: String, required: true },
  resolved: { type: Boolean, default: false },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  replies: [replySchema],
}, { timestamps: true });

// compound index for fetching comments by doc sorted by date
commentSchema.index({ documentId: 1, createdAt: -1 });
// index for finding unresolved comments quickly
commentSchema.index({ documentId: 1, resolved: 1 });

export const Comment = mongoose.model("Comment", commentSchema);
