import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as Y from "yjs";
import { io, Socket } from "socket.io-client";
import Editor from "../components/Editor";
import CollaboratorsPanel, { type PendingRequest } from "../components/CollaboratorsPanel";
import VersionHistory, { type Version } from "../components/VersionHistory";
import CommentsPanel, { type Comment } from "../components/CommentsPanel";
import GuestUpgradeModal from "../components/GuestUpgradeModal";
import { useAuthStore } from "../store/authStore";
import { colorFromId } from "../utils/color";
import { API_URL, SOCKET_URL } from "../utils/api";

interface Collaborator {
  userId: { _id: string; name: string; email: string } | string;
  role: "editor" | "viewer";
}

interface Doc {
  _id: string;
  title: string;
  content: string;
  owner: string;
  collaborators: Collaborator[];
  isOwner: boolean;
  myRole: "owner" | "editor" | "viewer";
}

export interface RemoteCursor {
  socketId: string;
  userId: string;
  position: number;
  name: string;
  color: string;
}

type AccessState = "loading" | "owner" | "approved" | "pending" | "role-select" | "waiting" | "denied";

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isGuest = !!user?.isGuest;

  const myColor = user?._id ? colorFromId(user._id) : "#6366f1";
  const myName = user?.name || "Anonymous";

  const [guestUpgradeReason, setGuestUpgradeReason] = useState<string | null>(null);
  const guardGuest = (reason: string, action: () => void) => {
    if (isGuest) { setGuestUpgradeReason(reason); return; }
    action();
  };

  const [doc, setDoc] = useState<Doc | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [restoreKey, setRestoreKey] = useState(0);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<{ socketId: string; userId?: string; name: string; color: string }[]>([
    { socketId: "me", userId: user?._id, name: myName, color: myColor },
  ]);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<Version | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [anchorLost, setAnchorLost] = useState(false);
  const [accessState, setAccessState] = useState<AccessState>("loading");
  const [requestedRole, setRequestedRole] = useState<"editor" | "viewer">("editor");

  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const socketRef = useRef<Socket | null>(null);
  const handleUpdateRef = useRef<(update: Uint8Array, origin: any) => void>(undefined);
  const accessStateRef = useRef<AccessState>("loading");
  const requestSentRef = useRef<string | null>(null);
  const requestedRoleRef = useRef<"editor" | "viewer">("editor");
  const selectionRef = useRef<{ from: number; to: number; text: string }>({ from: 0, to: 0, text: "" });
  const [currentSelection, setCurrentSelection] = useState<{ from: number; to: number; text: string }>({ from: 0, to: 0, text: "" });

  useEffect(() => { accessStateRef.current = accessState; }, [accessState]);
  useEffect(() => { requestedRoleRef.current = requestedRole; }, [requestedRole]);

  // Step 1: fetch doc
  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/documents/${id}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 403) { setAccessState("pending"); return null; }
        if (!res.ok) { navigate("/dashboard"); return null; }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setDoc(data);
        setAccessState(data.isOwner ? "owner" : "approved");
      });
  }, [id]);


  // Step 2: socket setup
  useEffect(() => {
    if (!id) return;
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("connect_error", () => setConnected(false));
    socket.on("disconnect", () => setConnected(false));

    socket.on("yjs-sync", (base64: string) => {
      Y.applyUpdate(ydocRef.current, Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
      setSynced(true);
    });

    socket.on("load-content", (html: string) => {
      setDoc((prev) => prev ? { ...prev, content: html } : prev);
      setSynced(true);
    });

    socket.on("yjs-update", (base64: string) => {
      Y.applyUpdate(ydocRef.current, Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
    });

    socket.on("cursor-update", (cursor: RemoteCursor) => {
      setRemoteCursors((prev) => [...prev.filter((c) => c.socketId !== cursor.socketId), cursor]);
      setOnlineUsers((prev) => {
        const me = prev.find((x) => x.socketId === "me")!;
        const others = prev.filter((x) => x.socketId !== "me" && x.socketId !== cursor.socketId);
        return [me, ...others, { socketId: cursor.socketId, userId: cursor.userId, name: cursor.name, color: cursor.color }];
      });
    });

    socket.on("cursor-remove", ({ userId }: { userId: string }) => {
      setRemoteCursors((prev) => prev.filter((c) => c.userId !== userId));
      setOnlineUsers((prev) => prev.filter((u) => u.socketId === "me" || u.userId !== userId));
    });

    socket.on("user-left", ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.socketId === "me" || u.userId !== userId));
      setRemoteCursors((prev) => prev.filter((c) => c.userId !== userId));
    });

    socket.on("user-joined", (u: { socketId: string; userId: string; name: string; color: string }) => {
      setOnlineUsers((prev) => {
        const me = prev.find((x) => x.socketId === "me")!;
        const others = prev.filter((x) => x.socketId !== "me" && x.socketId !== u.socketId);
        return [me, ...others, u];
      });
    });

    socket.on("join-rejected", () => {
      if (accessStateRef.current !== "approved" && accessStateRef.current !== "owner") {
        setAccessState("pending");
      }
    });
    socket.on("kicked", () => navigate("/dashboard"));

    socket.on("access-request", (req: PendingRequest) => {
      setPendingRequests((prev) => [...prev.filter((r) => r.socketId !== req.socketId), req]);
      setShowCollaborators(true);
    });

    socket.on("access-approved", ({ state }: { state: string; role: "editor" | "viewer" }) => {
      Y.applyUpdate(ydocRef.current, Uint8Array.from(atob(state), (c) => c.charCodeAt(0)));
      setSynced(true);
      fetch(`${API_URL}/api/documents/${id}`, { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          setDoc(data);
          setAccessState(data.isOwner ? "owner" : "approved");
        });
    });

    socket.on("access-denied", () => setAccessState("denied"));

    socket.on("doc-restored", ({ content, ownerUserId }: { content: string; ownerUserId: string }) => {
      if (user?._id !== ownerUserId) return;

      const oldYdoc = ydocRef.current;
      if (handleUpdateRef.current) oldYdoc.off("update", handleUpdateRef.current);
      oldYdoc.destroy();

      const freshYdoc = new Y.Doc();
      if (handleUpdateRef.current) freshYdoc.on("update", handleUpdateRef.current);
      ydocRef.current = freshYdoc;

      setDoc((prev) => prev ? { ...prev, content } : prev);
      setPreviewVersion(null);
      setRestoreKey((k) => k + 1);
      setSynced(true);
    });

    socket.on("yjs-replace", (state: string) => {
      const freshYdoc = new Y.Doc();
      Y.applyUpdate(freshYdoc, Uint8Array.from(atob(state), (c) => c.charCodeAt(0)));
      if (handleUpdateRef.current) {
        ydocRef.current.off("update", handleUpdateRef.current);
        ydocRef.current.destroy();
        freshYdoc.on("update", handleUpdateRef.current);
      }
      ydocRef.current = freshYdoc;
      setRestoreKey((k) => k + 1);
      setSynced(true);
    });

    socket.on("doc-evicted", () => {
      if (accessStateRef.current === "owner") return;
      navigate(`/dashboard?restored=1`);
    });

    socket.on("role-changed", ({ userId, role }: { userId: string; role: "editor" | "viewer" }) => {
      if (userId === user?._id) {
        setDoc((prev) => prev ? { ...prev, myRole: role } : prev);
      }
    });

    // real-time comment sync
    socket.on("comment-added", (comment: Comment) => {
      setComments(prev => prev.find(c => c._id === comment._id) ? prev : [comment, ...prev]);
    });
    socket.on("comment-updated", (comment: Comment) => {
      setComments(prev => prev.map(c => c._id === comment._id ? comment : c));
    });
    socket.on("comment-deleted", ({ commentId }: { commentId: string }) => {
      setComments(prev => prev.filter(c => c._id !== commentId));
      removeCommentMark(commentId);
    });

    const handleUpdate = (update: Uint8Array, origin: any) => {
      if (origin === socket) return;
      socket.emit("yjs-update", { documentId: id, update: btoa(String.fromCharCode(...update)) });
    };
    handleUpdateRef.current = handleUpdate;
    ydocRef.current.on("update", handleUpdate);

    return () => { socket.disconnect(); ydocRef.current.off("update", handleUpdate); };
  }, [id]);

  const isOwnerRef = useRef(false);
  useEffect(() => { if (doc) isOwnerRef.current = doc.isOwner; }, [doc]);

  // apply/remove comment marks via the editor instance
  const applyCommentMark = useCallback((commentId: string, color: string) => {
    const editor = (window as any).__editorRef;
    if (!editor) return;
    const { from, to } = selectionRef.current;
    if (from === to) return;
    editor.chain()
      .setTextSelection({ from, to })
      .setMark("comment", { commentId, color })
      .run();
  }, []);

  const removeCommentMark = useCallback((commentId: string) => {
    const editor = (window as any).__editorRef;
    if (!editor) return;
    const { state, dispatch } = editor.view;
    const { tr, doc } = state;
    doc.descendants((node: any, pos: number) => {
      node.marks.forEach((mark: any) => {
        if (mark.type.name === "comment" && mark.attrs.commentId === commentId) {
          tr.removeMark(pos, pos + node.nodeSize, mark.type);
        }
      });
    });
    dispatch(tr);
  }, []);
  // called by Editor after it loads initialContent into the fresh ydoc post-restore
  const onRestoreLoaded = useCallback(() => {
    if (!isOwnerRef.current) return;
    const state = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(ydocRef.current)));
    socketRef.current?.emit("yjs-replace", { documentId: id, state });
  }, [id]);

  // Step 3: react to accessState
  useEffect(() => {
    if (accessState === "loading") return;
    const socket = socketRef.current;
    if (!socket) return;

    const doJoin = () => {
      socket.emit("join-document", id);
      socket.emit("user-presence", { documentId: id, name: myName, color: myColor });
    };

    const doRequest = () => {
      if (requestSentRef.current === id) return;
      requestSentRef.current = id!;
      socket.emit("request-access", {
        documentId: id,
        name: myName,
        color: myColor,
        role: requestedRoleRef.current,
      });
    };

    if (accessState === "owner" || accessState === "approved") {
      if (socket.connected) doJoin();
      else socket.once("connect", doJoin);
    } else if (accessState === "waiting") {
      // role already selected, now send request
      if (socket.connected) doRequest();
      else socket.once("connect", doRequest);
    }
  }, [accessState, id]);

  const handleApprove = (req: PendingRequest) => {
    socketRef.current?.emit("approve-access", {
      requesterSocketId: req.socketId,
      documentId: id,
      userId: req.userId,
      role: req.role,
    });
    setPendingRequests((prev) => prev.filter((r) => r.socketId !== req.socketId));
  };

  const handleDeny = (req: PendingRequest) => {
    socketRef.current?.emit("deny-access", { requesterSocketId: req.socketId });
    setPendingRequests((prev) => prev.filter((r) => r.socketId !== req.socketId));
  };

  const handleRestore = async (version: Version) => {
    if (!window.confirm("Restore this version? Your current content will be saved as a snapshot first.")) return;
    await fetch(`${API_URL}/api/documents/${id}/versions/${version._id}/restore`, {
      method: "POST",
      credentials: "include",
    });
    setPreviewVersion(null);
    setShowHistory(false);
  };

  // comments
  useEffect(() => {
    if (!id || accessState === "loading" || accessState === "pending" || accessState === "waiting" || accessState === "denied") return;
    fetch(`${API_URL}/api/documents/${id}/comments`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setComments(data); });
  }, [id, accessState]);

  const handleAddComment = async (body: string, anchorText: string) => {
    const { text } = selectionRef.current;
    const resolvedAnchor = anchorText || text;
    const res = await fetch(`${API_URL}/api/documents/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ body, anchorText: resolvedAnchor, color: myColor }),
    });
    const data = await res.json();
    if (res.ok) {
      // don't add to state here — socket comment-added handles it for all users including sender
      applyCommentMark(data._id, myColor);
    }
  };

  const handleReply = async (commentId: string, body: string) => {
    await fetch(`${API_URL}/api/documents/${id}/comments/${commentId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ body }),
    });
    // socket comment-updated handles state
  };

  const handleResolve = async (commentId: string) => {
    const res = await fetch(`${API_URL}/api/documents/${id}/comments/${commentId}/resolve`, {
      method: "PATCH", credentials: "include",
    });
    if (res.ok) removeCommentMark(commentId);
    // socket comment-updated handles state
  };

  const handleReopen = async (commentId: string) => {
    await fetch(`${API_URL}/api/documents/${id}/comments/${commentId}/reopen`, {
      method: "PATCH", credentials: "include",
    });
    // socket comment-updated handles state
  };

  const handleDeleteComment = async (commentId: string) => {
    const res = await fetch(`${API_URL}/api/documents/${id}/comments/${commentId}`, {
      method: "DELETE", credentials: "include",
    });
    if (res.ok) removeCommentMark(commentId);
    // socket comment-deleted handles state
  };

  const handleCursorMove = useCallback((position: number) => {
    socketRef.current?.emit("cursor-move", { documentId: id, position, name: myName, color: myColor });
  }, [id, myName, myColor]);

  const saveContent = useCallback(async (content: string) => {
    setSaving(true); setSaved(false);
    await fetch(`${API_URL}/api/documents/${id}`, {
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

  // role selection screen
  if (accessState === "pending" || accessState === "role-select") return (
    <div style={styles.centerScreen}>
      <div style={styles.centerCard}>
        <p style={{ fontSize: "40px", margin: 0 }}>🔐</p>
        <h2 style={{ margin: 0, color: "var(--text-h)" }}>Request Access</h2>
        <p style={{ margin: 0, color: "var(--text)", fontSize: "14px" }}>Choose how you want to join this document</p>
        <div style={styles.roleRow}>
          <button
            style={{ ...styles.roleBtn, ...(requestedRole === "editor" ? styles.roleBtnActive : {}) }}
            onClick={() => setRequestedRole("editor")}
          >
            ✏️ Editor
            <span style={styles.roleDesc}>Can read & edit</span>
          </button>
          <button
            style={{ ...styles.roleBtn, ...(requestedRole === "viewer" ? styles.roleBtnActive : {}) }}
            onClick={() => setRequestedRole("viewer")}
          >
            👁 Viewer
            <span style={styles.roleDesc}>Can only read</span>
          </button>
        </div>
        <button
          style={{ ...styles.backBtn, background: "var(--accent)", color: "#fff", border: "none", width: "100%", padding: "10px", justifyContent: "center" }}
          onClick={() => { requestSentRef.current = null; setAccessState("waiting"); }}
        >
          Send Request as {requestedRole === "editor" ? "✏️ Editor" : "👁 Viewer"}
        </button>
        <button style={styles.backBtn} onClick={() => navigate("/dashboard")}>← Back</button>
      </div>
    </div>
  );

  // waiting screen — request sent, waiting for owner
  if (accessState === "waiting") return (
    <div style={styles.centerScreen}>
      <div style={styles.centerCard}>
        <p style={{ fontSize: "40px", margin: 0 }}>⏳</p>
        <h2 style={{ margin: 0, color: "var(--text-h)" }}>Waiting for approval</h2>
        <p style={{ margin: 0, color: "var(--text)", fontSize: "14px" }}>
          Requested as <strong>{requestedRole}</strong>. The owner needs to approve.
        </p>
        <button style={styles.backBtn} onClick={() => { setAccessState("pending"); requestSentRef.current = null; }}>← Change Role</button>
        <button style={styles.backBtn} onClick={() => navigate("/dashboard")}>← Back to Dashboard</button>
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

  if (accessState === "loading" || !doc) return (
    <div style={styles.centerScreen}><p style={{ color: "var(--text)" }}>Loading...</p></div>
  );

  const isOwner = doc.isOwner;
  const isViewer = doc.myRole === "viewer";

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate("/dashboard")}>← Back</button>
        <h2 style={styles.title}>{doc.title}</h2>
        <div style={styles.headerRight}>
          {/* show role badge for non-owners */}
          {!isOwner && (
            <span style={{ ...styles.myRoleBadge, ...(isViewer ? styles.viewerBadge : styles.editorBadge) }}>
              {isViewer ? "👁 Viewer" : "✏️ Editor"}
            </span>
          )}
          {isOwner && (
            <button style={styles.collabBtn} onClick={() => setShowCollaborators(true)}>
              👥 {doc.collaborators.length}
              {pendingRequests.length > 0 && <span style={styles.badge}>{pendingRequests.length}</span>}
            </button>
          )}
          <button style={styles.historyBtn} onClick={() => setShowHistory(true)}>🕐 History</button>
          {isOwner && (
            <button style={styles.shareBtn} onClick={() => guardGuest("Sharing documents", () => { navigator.clipboard.writeText(window.location.href); alert("Link copied!"); })}>
              Share 🔗
            </button>
          )}
          <span style={{ ...styles.connDot, background: connected ? "#22c55e" : "#ef4444" }} />
          <span style={styles.connLabel}>{connected ? "Live" : "Offline"}</span>
          <span style={styles.saveStatus}>{saving ? "Saving..." : saved ? "Saved ✓" : ""}</span>
        </div>
      </div>

      {guestUpgradeReason && (
        <GuestUpgradeModal
          reason={guestUpgradeReason}
          onClose={() => setGuestUpgradeReason(null)}
        />
      )}

      {!connected && (
        <div style={styles.offlineBanner}>
          ⚠️ You are offline. Trying to reconnect...
          <span style={styles.offlineDot} />
        </div>
      )}

      {isViewer && (
        <div style={styles.viewerBanner}>
          👁 You are viewing this document in read-only mode
        </div>
      )}

      {anchorLost && activeCommentId && (
        <div style={styles.anchorLostBanner}>
          <span>⚠️ The commented text was deleted from the document.</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={styles.anchorLostBtn} onClick={() => { setShowHistory(true); setAnchorLost(false); }}>
              View History
            </button>
            <button style={styles.anchorLostClose} onClick={() => setAnchorLost(false)}>✕</button>
          </div>
        </div>
      )}

      {previewVersion && (
        <div style={styles.previewBanner}>
          <span>👁 Previewing: <strong>{previewVersion.isManual ? (previewVersion.label || "Manual save") : "Auto-save"}</strong></span>
          <div style={{ display: "flex", gap: "8px" }}>
            {isOwner && (
              <button style={styles.restoreInlineBtn} onClick={() => handleRestore(previewVersion)}>Restore This</button>
            )}
            <button style={styles.exitPreviewBtn} onClick={() => setPreviewVersion(null)}>✕ Exit Preview</button>
          </div>
        </div>
      )}

      <div style={styles.body}>
        <div style={styles.editorCol}>
          {previewVersion ? (
            <div
              style={styles.previewContent}
              dangerouslySetInnerHTML={{ __html: previewVersion.content }}
            />
          ) : (
            synced ? <Editor
              key={restoreKey}
              ydoc={ydocRef.current}
              initialContent={doc.content}
              onChange={isViewer ? () => {} : handleChange}
              onCursorMove={handleCursorMove}
              onSelectionChange={(from, to, text) => {
                selectionRef.current = { from, to, text };
                // only update state when selected text changes to avoid re-render flicker
                setCurrentSelection(prev => {
                  if (prev.text === text && prev.from === from && prev.to === to) return prev;
                  return { from, to, text };
                });
              }}
              onCommentClick={(commentId) => {
                setActiveCommentId(prev => prev === commentId ? null : commentId);
                if (activeCommentId === commentId) { setAnchorLost(false); return; }
                // check if mark still exists in doc
                const editor = (window as any).__editorRef;
                if (!editor) return;
                let found = false;
                editor.state.doc.descendants((node: any) => {
                  if (found) return false;
                  if (node.marks?.some((m: any) => m.type.name === "comment" && m.attrs.commentId === commentId)) {
                    found = true;
                  }
                });
                setAnchorLost(!found);
              }}
              remoteCursors={remoteCursors}
              onlineUsers={onlineUsers}
              activeCommentId={activeCommentId}
              readOnly={isViewer}
              onContentLoaded={restoreKey > 0 ? onRestoreLoaded : undefined}
            /> : <p style={{ textAlign: "center", color: "var(--text)", marginTop: "40px" }}>Syncing...</p>
          )}
        </div>

        <CommentsPanel
          docId={id!}
          comments={comments}
          canComment={!isViewer}
          isGuest={isGuest}
          currentUserId={user?._id ?? ""}
          isOwner={isOwner}
          activeCommentId={activeCommentId}
          currentSelection={currentSelection}
          onAdd={handleAddComment}
          onReply={handleReply}
          onResolve={handleResolve}
          onReopen={handleReopen}
          onDelete={handleDeleteComment}
          onSelect={(commentId) => {
            setActiveCommentId(prev => {
              if (prev === commentId) { setAnchorLost(false); return null; }
              // check if mark exists
              const editor = (window as any).__editorRef;
              if (editor && commentId) {
                let found = false;
                editor.state.doc.descendants((node: any) => {
                  if (found) return false;
                  if (node.marks?.some((m: any) => m.type.name === "comment" && m.attrs.commentId === commentId)) found = true;
                });
                setAnchorLost(!found);
              }
              return commentId;
            });
          }}
        />
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

      {showHistory && (
        <VersionHistory
          docId={id!}
          isOwner={isOwner}
          canSave={!isViewer}
          onPreview={(v) => { setPreviewVersion(v); setShowHistory(false); }}
          onRestore={handleRestore}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { height: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", gap: "16px", padding: "16px 32px", borderBottom: "1px solid var(--border)", flexShrink: 0 },
  backBtn: { padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "14px", fontFamily: "var(--sans)" },
  title: { margin: 0, flex: 1, fontSize: "20px" },
  headerRight: { display: "flex", alignItems: "center", gap: "8px" },
  connDot: { width: "8px", height: "8px", borderRadius: "50%", display: "inline-block" },
  connLabel: { fontSize: "13px", color: "var(--text)" },
  saveStatus: { fontSize: "13px", color: "var(--text)" },
  shareBtn: { padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--accent-border)", background: "var(--accent-bg)", color: "var(--accent)", cursor: "pointer", fontSize: "13px", fontWeight: 500, fontFamily: "var(--sans)" },
  collabBtn: { position: "relative", padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-h)", cursor: "pointer", fontSize: "13px", fontFamily: "var(--sans)" },
  badge: { position: "absolute", top: "-6px", right: "-6px", background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: 700, width: "16px", height: "16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  myRoleBadge: { fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px" },
  editorBadge: { background: "#dbeafe", color: "#1d4ed8" },
  viewerBadge: { background: "#f3f4f6", color: "#6b7280" },
  viewerBanner: { background: "#f3f4f6", color: "#6b7280", textAlign: "center", padding: "8px", fontSize: "13px", borderBottom: "1px solid var(--border)", flexShrink: 0 },
  offlineBanner: { background: "#fef2f2", color: "#991b1b", textAlign: "center", padding: "8px", fontSize: "13px", borderBottom: "1px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", flexShrink: 0 },
  offlineDot: { width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444", animation: "pulse 1.5s ease-in-out infinite" },
  anchorLostBanner: { background: "#fef3c7", color: "#92400e", padding: "8px 32px", fontSize: "13px", borderBottom: "1px solid #fde68a", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexShrink: 0 },
  anchorLostBtn: { padding: "3px 10px", borderRadius: "5px", border: "1px solid #92400e", background: "transparent", color: "#92400e", cursor: "pointer", fontSize: "12px", fontFamily: "var(--sans)", fontWeight: 600 },
  anchorLostClose: { padding: "3px 8px", borderRadius: "5px", border: "none", background: "transparent", color: "#92400e", cursor: "pointer", fontSize: "13px" },
  content: { maxWidth: "860px", width: "100%", margin: "40px auto", padding: "0 24px", boxSizing: "border-box" },
  body: { display: "flex", flex: 1, overflow: "hidden", minHeight: 0 },
  editorCol: { flex: 1, overflowY: "auto", padding: "40px 32px" },
  centerScreen: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-subtle)" },
  centerCard: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "16px", padding: "48px 40px", textAlign: "center", maxWidth: "440px", width: "100%", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" },
  roleRow: { display: "flex", gap: "12px", width: "100%" },
  roleBtn: { flex: 1, padding: "12px", borderRadius: "10px", border: "2px solid var(--border)", background: "var(--bg-subtle)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", fontSize: "14px", fontWeight: 600, color: "var(--text-h)", fontFamily: "var(--sans)", transition: "border-color 0.15s" },
  roleBtnActive: { borderColor: "var(--accent)", background: "var(--accent-bg)", color: "var(--accent)" },
  historyBtn: { padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "13px", fontFamily: "var(--sans)" },
  previewBanner: { background: "#fef9c3", color: "#854d0e", padding: "10px 32px", fontSize: "13px", borderBottom: "1px solid #fde68a", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  restoreInlineBtn: { padding: "4px 12px", borderRadius: "6px", border: "none", background: "#854d0e", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "var(--sans)" },
  exitPreviewBtn: { padding: "4px 12px", borderRadius: "6px", border: "1px solid #854d0e", background: "transparent", color: "#854d0e", cursor: "pointer", fontSize: "12px", fontFamily: "var(--sans)" },
  previewContent: { border: "1px solid var(--border)", borderRadius: "10px", background: "var(--bg)", padding: "24px", minHeight: "500px", fontSize: "16px", lineHeight: "1.7", color: "var(--text-h)", opacity: 0.85 },
  roleDesc: { fontSize: "11px", fontWeight: 400, color: "var(--text)" },
};
