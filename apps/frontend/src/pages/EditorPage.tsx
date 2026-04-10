import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as Y from "yjs";
import { io, Socket } from "socket.io-client";
import Editor from "../components/Editor";
import CollaboratorsPanel, { type PendingRequest } from "../components/CollaboratorsPanel";
import { useAuthStore } from "../store/authStore";
import { colorFromId } from "../utils/color";

interface Collaborator {
  _id: string;
  name: string;
  email: string;
  cursorColor: string;
}

interface Doc {
  _id: string;
  title: string;
  content: string;
  owner: string;
  collaborators: Collaborator[];
}

export interface RemoteCursor {
  socketId: string;
  userId: string;
  position: number;
  name: string;
  color: string;
}

type AccessState = "loading" | "owner" | "approved" | "pending" | "denied";

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // auto-generate color from userId — consistent, no manual picking
  const myColor = user?._id ? colorFromId(user._id) : "#6366f1";
  const myName = user?.name || "Anonymous";

  const [doc, setDoc] = useState<Doc | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<{ socketId: string; userId?: string; name: string; color: string }[]>(() => [
    { socketId: "me", userId: user?._id, name: myName, color: myColor },
  ]);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [accessState, setAccessState] = useState<AccessState>("loading");

  const ydocRef = useRef<Y.Doc | null>(null);
  if (!ydocRef.current) ydocRef.current = new Y.Doc();
  const socketRef = useRef<Socket | null>(null);
  const requestSentRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    const ydoc = ydocRef.current!;

    fetch(`http://localhost:5000/api/documents/${id}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 403) { setAccessState("pending"); return null; }
        if (!res.ok) { navigate("/dashboard"); return null; }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setDoc(data);
        const ownerStr = typeof data.owner === "object" ? data.owner._id : data.owner;
        setAccessState(ownerStr === user?._id ? "owner" : "approved");
      });

    const socket = io("http://localhost:5000", { withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-document", id);
      socket.emit("user-presence", { documentId: id, name: myName, color: myColor });
    });
    socket.on("connect_error", () => setConnected(false));
    socket.on("disconnect", () => setConnected(false));

    socket.on("yjs-sync", (base64: string) => {
      Y.applyUpdate(ydoc, Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
      setSynced(true);
    });

    socket.on("load-content", (html: string) => {
      setDoc((prev) => prev ? { ...prev, content: html } : prev);
      setSynced(true);
    });

    socket.on("yjs-update", (base64: string) => {
      Y.applyUpdate(ydoc, Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
    });

    socket.on("cursor-update", (cursor: RemoteCursor) => {
      setRemoteCursors((prev) => [...prev.filter((c) => c.userId !== cursor.userId), cursor]);
      setOnlineUsers((prev) => [
        prev.find((x) => x.socketId === "me")!,
        ...prev.filter((x) => x.socketId !== "me" && x.userId !== cursor.userId),
        { socketId: cursor.socketId, userId: cursor.userId, name: cursor.name, color: cursor.color },
      ]);
    });

    socket.on("cursor-remove", ({ userId }: { socketId: string; userId: string }) => {
      setRemoteCursors((prev) => prev.filter((c) => c.userId !== userId));
      setOnlineUsers((prev) => prev.filter((u) => u.socketId === "me" || u.userId !== userId));
    });

    // user left — remove from online list immediately
    socket.on("user-left", ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.socketId === "me" || u.userId !== userId));
      setRemoteCursors((prev) => prev.filter((c) => c.userId !== userId));
    });

    socket.on("user-joined", (u: { socketId: string; userId: string; name: string; color: string }) => {
      setOnlineUsers((prev) => [
        prev.find((x) => x.socketId === "me")!,
        ...prev.filter((x) => x.socketId !== "me" && x.userId !== u.userId),
        u,
      ]);
    });

    // someone new joined — re-announce our presence to them
    socket.on("announce-presence", ({ documentId }: { documentId: string }) => {
      socket.emit("user-presence", { documentId, name: myName, color: myColor });
    });

    socket.on("kicked", () => navigate("/dashboard"));

    socket.on("access-request", (req: PendingRequest) => {
      setPendingRequests((prev) => [...prev.filter((r) => r.socketId !== req.socketId), req]);
      setShowCollaborators(true);
    });

    socket.on("access-approved", ({ state }: { state: string }) => {
      Y.applyUpdate(ydoc, Uint8Array.from(atob(state), (c) => c.charCodeAt(0)));
      setAccessState("approved");
      setSynced(true);
    });

    socket.on("access-denied", () => setAccessState("denied"));

    const handleUpdate = (update: Uint8Array, origin: any) => {
      if (origin === socket) return;
      socket.emit("yjs-update", { documentId: id, update: btoa(String.fromCharCode(...update)) });
    };
    ydoc.on("update", handleUpdate);

    return () => { socket.disconnect(); ydoc.off("update", handleUpdate); };
  }, [id]);

  // pending: emit request-access ONCE
  useEffect(() => {
    if (accessState !== "pending" || requestSentRef.current) return;
    const socket = socketRef.current;
    if (!socket) return;
    const emit = () => {
      if (requestSentRef.current) return;
      requestSentRef.current = true;
      socket.emit("request-access", { documentId: id, name: myName, color: myColor });
    };
    if (socket.connected) emit();
    else socket.once("connect", emit);
  }, [accessState, id]);

  const handleApprove = (req: PendingRequest) => {
    socketRef.current?.emit("approve-access", { requesterSocketId: req.socketId, documentId: id, userId: req.userId });
    setPendingRequests((prev) => prev.filter((r) => r.socketId !== req.socketId));
    setDoc((prev) => prev ? {
      ...prev,
      collaborators: [...prev.collaborators, { _id: req.userId, name: req.name, email: "", cursorColor: req.color }]
    } : prev);
  };

  const handleDeny = (req: PendingRequest) => {
    socketRef.current?.emit("deny-access", { requesterSocketId: req.socketId });
    setPendingRequests((prev) => prev.filter((r) => r.socketId !== req.socketId));
  };

  const handleCursorMove = useCallback((position: number) => {
    socketRef.current?.emit("cursor-move", { documentId: id, position, name: myName, color: myColor });
  }, [id, myName, myColor]);

  const saveContent = useCallback(async (content: string) => {
    setSaving(true); setSaved(false);
    await fetch(`http://localhost:5000/api/documents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    });
    setSaving(false); setSaved(true);
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

  if (accessState === "loading" || !doc) return (
    <div style={styles.centerScreen}><p style={{ color: "var(--text)" }}>Loading...</p></div>
  );

  if (accessState === "pending") return (
    <div style={styles.centerScreen}>
      <div style={styles.centerCard}>
        <p style={{ fontSize: "40px", margin: 0 }}>⏳</p>
        <h2 style={{ margin: 0, color: "var(--text-h)" }}>Waiting for approval</h2>
        <p style={{ margin: 0, color: "var(--text)", fontSize: "14px" }}>The document owner needs to approve your request.</p>
        <button style={styles.backBtn} onClick={() => navigate("/dashboard")}>← Back</button>
      </div>
    </div>
  );

  if (accessState === "denied") return (
    <div style={styles.centerScreen}>
      <div style={styles.centerCard}>
        <p style={{ fontSize: "40px", margin: 0 }}>🚫</p>
        <h2 style={{ margin: 0, color: "var(--text-h)" }}>Access Denied</h2>
        <p style={{ margin: 0, color: "var(--text)", fontSize: "14px" }}>The owner denied your request.</p>
        <button style={styles.backBtn} onClick={() => navigate("/dashboard")}>← Back</button>
      </div>
    </div>
  );

  const isOwner = accessState === "owner";

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate("/dashboard")}>← Back</button>
        <h2 style={styles.title}>{doc.title}</h2>
        <div style={styles.headerRight}>
          {isOwner && (
            <button style={styles.collabBtn} onClick={() => setShowCollaborators(true)}>
              👥 {doc.collaborators.length}
              {pendingRequests.length > 0 && <span style={styles.badge}>{pendingRequests.length}</span>}
            </button>
          )}
          {isOwner && (
            <button style={styles.shareBtn} onClick={() => { navigator.clipboard.writeText(window.location.href); alert("Link copied!"); }}>
              Share 🔗
            </button>
          )}
          <span style={{ ...styles.connDot, background: connected ? "#22c55e" : "#ef4444" }} />
          <span style={styles.connLabel}>{connected ? "Live" : "Offline"}</span>
          <span style={styles.saveStatus}>{saving ? "Saving..." : saved ? "Saved ✓" : ""}</span>
        </div>
      </div>

      <div style={styles.content}>
        {synced && <Editor
          ydoc={ydocRef.current!}
          initialContent={doc.content}
          onChange={handleChange}
          onCursorMove={handleCursorMove}
          remoteCursors={remoteCursors}
          onlineUsers={onlineUsers}
        />}
        {!synced && <p style={{ textAlign: "center", color: "var(--text)", marginTop: "40px" }}>Syncing...</p>}
      </div>

      {showCollaborators && isOwner && (
        <CollaboratorsPanel
          docId={id!}
          collaborators={doc.collaborators}
          pendingRequests={pendingRequests}
          onlineUsers={onlineUsers}
          onUpdate={(collaborators) => setDoc((prev) => prev ? { ...prev, collaborators } : prev)}
          onApprove={handleApprove}
          onDeny={handleDeny}
          onKick={(socketId) => socketRef.current?.emit("kick-user", { documentId: id, targetSocketId: socketId })}
          onClose={() => setShowCollaborators(false)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", gap: "16px", padding: "16px 32px", borderBottom: "1px solid var(--border)" },
  backBtn: { padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "14px", fontFamily: "var(--sans)" },
  title: { margin: 0, flex: 1, fontSize: "20px" },
  headerRight: { display: "flex", alignItems: "center", gap: "8px" },
  connDot: { width: "8px", height: "8px", borderRadius: "50%", display: "inline-block" },
  connLabel: { fontSize: "13px", color: "var(--text)" },
  saveStatus: { fontSize: "13px", color: "var(--text)" },
  shareBtn: { padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--accent-border)", background: "var(--accent-bg)", color: "var(--accent)", cursor: "pointer", fontSize: "13px", fontWeight: 500, fontFamily: "var(--sans)" },
  collabBtn: { position: "relative", padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-h)", cursor: "pointer", fontSize: "13px", fontFamily: "var(--sans)" },
  badge: { position: "absolute", top: "-6px", right: "-6px", background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: 700, width: "16px", height: "16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  content: { maxWidth: "860px", width: "100%", margin: "40px auto", padding: "0 24px", boxSizing: "border-box" },
  centerScreen: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-subtle)" },
  centerCard: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "16px", padding: "48px 40px", textAlign: "center", maxWidth: "400px", width: "100%", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" },
};
