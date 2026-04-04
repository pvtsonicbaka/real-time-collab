import { Request, Response, NextFunction } from "express";
import { Document } from "../models/Document";

export const isOwner = async (req: any, res: Response, next: NextFunction) => {
  try {
    const doc = await Document.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (doc.owner.toString() !== req.user) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // attach document to request for later use
    req.doc = doc;

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ownership check failed" });
  }
};