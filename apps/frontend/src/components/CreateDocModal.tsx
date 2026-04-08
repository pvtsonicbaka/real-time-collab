import { useState, useEffect } from "react";
import type { Doc } from "../hooks/useDocuments";

interface Props {
  onClose: () => void;
  onCreated: (doc: Doc) => void;
}

export default function CreateDocModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        return setError(data.message);
      }

      const doc = await res.json();
      onCreated(doc);
      onClose();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.headerIcon}>📄</span>
            <div>
              <h2 style={s.title}>New Document</h2>
              <p style={s.subtitle}>Create a new document to start writing</p>
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Title <span style={s.required}>*</span></label>
            <input
              style={s.input}
              type="text"
              placeholder="e.g. Project Proposal"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              autoFocus
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Initial Content <span style={s.optional}>(optional)</span></label>
            <textarea
              style={s.textarea}
              placeholder="Start with some content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
          </div>

          {error && (
            <div style={s.errorBox}>
              ⚠️ {error}
            </div>
          )}

          <div style={s.actions}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" style={s.createBtn} disabled={loading}>
              {loading ? "Creating..." : "✦ Create Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100 },
  modal: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "460px", boxShadow: "var(--shadow)" },

  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px" },
  headerIcon: { fontSize: "28px" },
  title: { fontSize: "18px", fontWeight: 700, color: "var(--text-h)", margin: "0 0 2px" },
  subtitle: { fontSize: "13px", color: "var(--text)", margin: 0 },
  closeBtn: { background: "transparent", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--text)", padding: "4px", borderRadius: "6px", lineHeight: 1 },

  form: { display: "flex", flexDirection: "column", gap: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: 500, color: "var(--text-h)" },
  required: { color: "var(--accent)" },
  optional: { color: "var(--text)", fontWeight: 400 },
  input: { padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--code-bg)", color: "var(--text-h)", fontSize: "15px", outline: "none", fontFamily: "var(--sans)", transition: "border-color 0.15s" },
  textarea: { padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--code-bg)", color: "var(--text-h)", fontSize: "14px", resize: "vertical", fontFamily: "var(--sans)", outline: "none", lineHeight: 1.6 },

  errorBox: { background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#e53e3e" },

  actions: { display: "flex", gap: "10px", justifyContent: "flex-end", paddingTop: "4px" },
  cancelBtn: { padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "14px", fontFamily: "var(--sans)" },
  createBtn: { padding: "8px 18px", borderRadius: "8px", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 500, fontFamily: "var(--sans)" },
};
