import { useState } from "react";
import { colorFromId } from "../utils/color";
import { API_URL } from "../utils/api";

interface Collaborator {
  userId: { _id: string; name: string; email: string } | string;
  role: "editor" | "viewer";
}

export interface PendingRequest {
  socketId: string;
  userId: string;
  name: string;
  color: string;
  role: "editor" | "viewer";
}

interface Props {
  docId: string;
  collaborators: Collaborator[];
  pendingRequests: PendingRequest[];
  onlineUsers: { socketId: string; userId?: string; name: string; color: string }[];
  onUpdate: (collaborators: Collaborator[]) => void;
  onApprove: (req: PendingRequest) => void;
  onDeny: (req: PendingRequest) => void;
  onKick: (socketId: string) => void;
  onClose: () => void;
}

export default function CollaboratorsPanel({ docId, collaborators, pendingRequests, onlineUsers, onUpdate, onApprove, onDeny, onKick, onClose }: Props) {

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [showInvite, setShowInvite] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteStatus("sending");
    try {
      const res = await fetch(`${API_URL}/api/documents/${docId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteStatus(res.ok ? "sent" : "error");
      if (res.ok) { setInviteEmail(""); setTimeout(() => { setInviteStatus("idle"); setShowInvite(false); }, 2000); }
    } catch {
      setInviteStatus("error");
    }
  };

  const getUserId = (c: Collaborator) =>
    typeof c.userId === "object" ? c.userId._id : c.userId;
  const getUserName = (c: Collaborator) =>
    typeof c.userId === "object" ? c.userId.name : "Unknown";
  const getUserEmail = (c: Collaborator) =>
    typeof c.userId === "object" ? c.userId.email : "";

  const handleRemove = async (userId: string) => {
    const onlineEntry = onlineUsers.find((u) => u.userId === userId && u.socketId !== "me");
    if (onlineEntry) onKick(onlineEntry.socketId);
    const res = await fetch(`${API_URL}/api/documents/${docId}/collaborator/${userId}`, {
      method: "DELETE", credentials: "include",
    });
    const data = await res.json();
    if (res.ok) onUpdate(data.collaborators);
  };

  const handleRoleChange = async (userId: string, role: "editor" | "viewer") => {
    const res = await fetch(`${API_URL}/api/documents/${docId}/collaborator/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (res.ok) onUpdate(data.collaborators);
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>Collaborators</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Invite button */}
        <button style={s.inviteBtn} onClick={() => setShowInvite(!showInvite)}>
          📧 Invite via Email
        </button>

        {/* Invite form */}
        {showInvite && (
          <div style={s.inviteBox}>
            <input
              type="email"
              placeholder="Enter email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={s.input}
            />
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} style={s.select}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button style={s.sendBtn} onClick={handleInvite} disabled={inviteStatus === "sending"}>
                {inviteStatus === "sending" ? "Sending..." : inviteStatus === "sent" ? "✓ Sent" : "Send"}
              </button>
            </div>
            {inviteStatus === "error" && <p style={s.errorText}>Failed to send invite</p>}
          </div>
        )}

        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <div style={s.section}>
            <p style={s.sectionLabel}>PENDING REQUESTS</p>
            {pendingRequests.map((req) => (
              <div key={req.socketId} style={s.requestItem}>
                <div style={{ ...s.dot, background: req.color }}>{req.name[0].toUpperCase()}</div>
                <div style={s.info}>
                  <p style={s.reqName}>{req.name}</p>
                  <span style={{ ...s.roleBadge, ...(req.role === "viewer" ? s.viewerBadge : s.editorBadge) }}>
                    {req.role}
                  </span>
                </div>
                <button style={s.approveBtn} onClick={() => onApprove(req)}>Approve</button>
                <button style={s.denyBtn} onClick={() => onDeny(req)}>Deny</button>
              </div>
            ))}
          </div>
        )}

        {/* Whitelist */}
        <div style={s.section}>
          <p style={s.sectionLabel}>WHITELIST</p>
          {collaborators.length === 0 ? (
            <p style={s.empty}>No collaborators yet. Share the link and approve requests.</p>
          ) : (
            collaborators.map((c) => {
              const uid = getUserId(c);
              const onlineEntry = onlineUsers.find((u) => u.userId === uid && u.socketId !== "me");
              const isOnline = !!onlineEntry;
              return (
                <div key={uid} style={s.item}>
                  <div style={{ position: "relative" }}>
                    <div style={{ ...s.dot, background: colorFromId(uid) }}>
                      {getUserName(c)[0]?.toUpperCase()}
                    </div>
                    {isOnline && <span style={s.onlineDot} />}
                  </div>
                  <div style={s.info}>
                    <p style={s.name}>{getUserName(c)}</p>
                    <p style={s.email}>{getUserEmail(c)}</p>
                  </div>
                  {/* role toggle */}
                  <button
                    style={{ ...s.roleToggle, ...(c.role === "editor" ? s.editorBadge : s.viewerBadge) }}
                    onClick={() => handleRoleChange(uid, c.role === "editor" ? "viewer" : "editor")}
                    title="Click to toggle role"
                  >
                    {c.role}
                  </button>
                  {isOnline && onlineEntry && (
                    <button style={s.kickBtn} onClick={() => onKick(onlineEntry.socketId)}>Kick</button>
                  )}
                  <button style={s.removeBtn} onClick={() => handleRemove(uid)}>✕</button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)", zIndex: 50, display: "flex", justifyContent: "flex-end" },
  panel: { background: "var(--bg)", borderLeft: "1px solid var(--border)", width: "320px", height: "100%", display: "flex", flexDirection: "column", padding: "24px", gap: "16px", overflowY: "auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-h)" },
  closeBtn: { background: "transparent", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--text)", padding: "4px" },
  section: { display: "flex", flexDirection: "column", gap: "8px" },
  sectionLabel: { margin: "0 0 4px", fontSize: "11px", fontWeight: 600, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.6px" },
  requestItem: { display: "flex", alignItems: "center", gap: "8px", padding: "10px", borderRadius: "8px", background: "var(--accent-bg)", border: "1px solid var(--accent-border)" },
  item: { display: "flex", alignItems: "center", gap: "8px", padding: "10px", borderRadius: "8px", background: "var(--bg-subtle)", border: "1px solid var(--border)" },
  dot: { width: "30px", height: "30px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#fff", flexShrink: 0 },
  info: { flex: 1, overflow: "hidden" },
  name: { margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--text-h)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  reqName: { margin: "0 0 2px", fontSize: "13px", fontWeight: 600, color: "var(--text-h)" },
  email: { margin: 0, fontSize: "11px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  roleBadge: { fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "4px", display: "inline-block" },
  roleToggle: { fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", cursor: "pointer", border: "none", flexShrink: 0 },
  editorBadge: { background: "#dbeafe", color: "#1d4ed8" },
  viewerBadge: { background: "#f3f4f6", color: "#6b7280" },
  approveBtn: { padding: "4px 10px", borderRadius: "6px", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "12px", fontFamily: "var(--sans)", flexShrink: 0 },
  denyBtn: { padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "12px", fontFamily: "var(--sans)", flexShrink: 0 },
  removeBtn: { padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "12px", flexShrink: 0 },
  kickBtn: { padding: "4px 8px", borderRadius: "6px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "12px", flexShrink: 0 },
  onlineDot: { position: "absolute", bottom: 0, right: 0, width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", border: "2px solid var(--bg)" } as React.CSSProperties,
  empty: { margin: 0, fontSize: "13px", color: "var(--text)", lineHeight: "1.5" },
  inviteBtn: { padding: "8px 14px", borderRadius: "8px", border: "1px dashed var(--accent)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: "13px", fontWeight: 600, textAlign: "left" },
  inviteBox: { display: "flex", flexDirection: "column", gap: "8px", padding: "12px", borderRadius: "8px", background: "var(--bg-subtle)", border: "1px solid var(--border)" },
  input: { padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-h)", fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box" },
  select: { padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-h)", fontSize: "13px", cursor: "pointer" },
  sendBtn: { padding: "6px 14px", borderRadius: "6px", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600 },
  errorText: { margin: 0, fontSize: "12px", color: "#ef4444" },
};
