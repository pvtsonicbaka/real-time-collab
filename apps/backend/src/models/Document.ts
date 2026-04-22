import mongoose from "mongoose";

const collaboratorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["editor", "viewer"], default: "editor" },
}, { _id: false });

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    collaborators: [collaboratorSchema],
  },
  { timestamps: true }
);

documentSchema.index({ title: "text", content: "text" }, { weights: { title: 10, content: 1 } });

export const Document = mongoose.model("Document", documentSchema);
