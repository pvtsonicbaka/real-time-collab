import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as Y from "yjs";
import { io, Socket } from "socket.io-client";
import Editor from "../components/Editor";

interface Doc {
  _id: string;
  title: string;
  content: string;
}

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);

  const ydocRef = useRef<Y.Doc | null>(null);
  if (!ydocRef.current) ydocRef.current = new Y.Doc();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!id) return;
    const ydoc = ydocRef.current!;

    // 1. fetch doc title from MongoDB (content comes from ydoc sync)
    fetch(`http://localhost:5000/api/documents/${id}`, { credentials: "include" })
      .then((res) => { if (!res.ok) { navigate("/dashboard"); return null; } return res.json(); })
      .then((data) => { if (data) setDoc(data); });

    // 2. connect socket
    const socket = io("http://localhost:5000", { withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-document", id);
    });
    socket.on("connect_error", () => setConnected(false));
    socket.on("disconnect", () => setConnected(false));

    // 3. receive full ydoc state from server on join
    socket.on("yjs-sync", (base64: string) => {
      const uint8 = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      Y.applyUpdate(ydoc, uint8);
      setSynced(true);
    });

    // first user joining — load HTML from MongoDB into ydoc via editor
    socket.on("load-content", (html: string) => {
      setDoc((prev) => prev ? { ...prev, content: html } : prev);
      setSynced(true);
    });

    // 4. receive incremental updates from other users
    socket.on("yjs-update", (base64: string) => {
      const uint8 = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      Y.applyUpdate(ydoc, uint8);
    });

    // 5. send local changes to server
    const handleUpdate = (update: Uint8Array, origin: any) => {
      if (origin === socket) return; // don't echo back
      const base64 = btoa(String.fromCharCode(...update));
      socket.emit("yjs-update", { documentId: id, update: base64 });
    };
    ydoc.on("update", handleUpdate);

    return () => {
      socket.disconnect();
      ydoc.off("update", handleUpdate);
    };
  }, [id]);

  const saveContent = useCallback(async (content: string) => {
    setSaving(true);
    setSaved(false);
    await fetch(`http://localhost:5000/api/documents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [id]);

  const handleChange = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (content: string) => {
        clearTimeout(timer);
        timer = setTimeout(() => saveContent(content), 1000);
      };
    })(),
    [saveContent]
  );

  if (!doc) return <p style={{ textAlign: "center", marginTop: "40px" }}>Loading...</p>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate("/dashboard")}>← Back</button>
        <h2 style={styles.title}>{doc.title}</h2>
        <div style={styles.headerRight}>
          <span style={{ ...styles.connDot, background: connected ? "#22c55e" : "#ef4444" }} />
          <span style={styles.connLabel}>{connected ? "Live" : "Offline"}</span>
          <span style={styles.saveStatus}>{saving ? "Saving..." : saved ? "Saved ✓" : ""}</span>
        </div>
      </div>
      <div style={styles.content}>
        {synced && <Editor ydoc={ydocRef.current!} initialContent={doc.content} onChange={handleChange} />}
        {!synced && <p style={{ textAlign: "center", color: "var(--text)", marginTop: "40px" }}>Syncing...</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", gap: "16px", padding: "16px 32px", borderBottom: "1px solid var(--border)" },
  backBtn: { padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "14px" },
  title: { margin: 0, flex: 1, fontSize: "20px" },
  headerRight: { display: "flex", alignItems: "center", gap: "8px" },
  connDot: { width: "8px", height: "8px", borderRadius: "50%", display: "inline-block" },
  connLabel: { fontSize: "13px", color: "var(--text)" },
  saveStatus: { fontSize: "13px", color: "var(--text)" },
  content: { maxWidth: "860px", width: "100%", margin: "40px auto", padding: "0 24px", boxSizing: "border-box" },
};
