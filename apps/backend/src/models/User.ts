import mongoose from "mongoose";

const GUEST_TTL_SECONDS = 2 * 60 * 60; // 2 hours — matches guest token expiry

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: "" },
    cursorColor: { type: String, default: "#6366f1" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isGuest: { type: Boolean, default: false },
    // TTL index: MongoDB auto-deletes guest docs after 2 h (non-guests have expiresAt: null)
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// sparse so the TTL index only applies to documents where expiresAt is set
userSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

export const User = mongoose.model("User", userSchema);
export { GUEST_TTL_SECONDS };