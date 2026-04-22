import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { Document } from "../models/Document";

dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI!);
  console.log("Connected to MongoDB");

  const existing = await User.findOne({ email: "demo@collabdocs.dev" });
  if (!existing) {
    const hashed = await bcrypt.hash("demo1234", 10);
    const user = await User.create({
      name: "Demo User",
      email: "demo@collabdocs.dev",
      password: hashed,
      cursorColor: "#6366f1",
    });

    await Document.create({
      title: "Welcome to CollabDocs 👋",
      content: `<h1>Welcome to CollabDocs!</h1><p>This is a real-time collaborative document editor. Try editing — changes sync instantly across all connected users.</p><h2>Features</h2><ul><li>Real-time collaborative editing</li><li>Live cursors</li><li>Comments with highlights</li><li>Version history</li><li>Role-based access control</li></ul>`,
      owner: user._id,
    });

    console.log("✅ Demo user created: demo@collabdocs.dev / demo1234");
  } else {
    console.log("Demo user already exists");
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
