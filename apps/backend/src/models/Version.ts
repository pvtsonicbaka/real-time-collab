import mongoose from "mongoose";

const versionSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    content: { type: String, required: true },
    savedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, default: "" },
    isManual: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// compound index for fetching versions by doc sorted by date
versionSchema.index({ documentId: 1, createdAt: -1 });

export const Version = mongoose.model("Version", versionSchema);
