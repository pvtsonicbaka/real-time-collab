import { useState } from "react";

interface Collaborator {
  _id: string;
  name: string;
  email: string;
  cursorColor: string;
}

export interface PendingRequest {
  socketId: string;
  userId: string;
  name: string;
  color: string;
}

interface Props {
  docId: string;
  collaborators: Collaborator[];
  pendingRequests: PendingRequest[];
  onlineUsers: { socketId: string; name: string; color: string }[];
  onUpdate: (collaborators: Collaborator[]) => void;
  onApprove: (req: PendingRequest) => void;
  onDeny: (req: PendingRequest) => void;
  onKick: (socketId: string) => void;
  onClose: () => void;
}

export default function CollaboratorsPanel({ docId, collaborators, pendingRequests, onlineUsers, onUpdate, onApprove, onDeny, onKick, onClose }: Props) {
  const [error, setError] = useState("");

  const handleRemove = async (userId: string) => {
    const res = await fetch(`http://localhost:5000/api/documents/${docId}/collaborator/${userId}`, {
      method: "DELETE",
      credentials: "include",
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

        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <div style={s.section}>
            <p style={s.sectionLabel}>PENDING REQUESTS</p>
            {pendingRequests.map((req) => (
              <div key={req.socketId} style={s.requestItem}>
                <div style={{ ...s.dot, background: req.color }}>{req.name[0].toUpperCase()}</div>
                <p style={s.reqName}>{req.name}</p>
                <button style={s.approveBtn} onClick={() => onApprove(req)}>Approve</button>
                <button style={s.denyBtn} onClick={() => onDeny(req)}>Deny</button>
              </div>
            ))}
          </div>
        )}

        {/* Collaborator list */}
        <div style={s.section}>
          <p style={s.sectionLabel}>WHITELIST</p>
          {error && <p style={s.error}>{error}</p>}
          {collaborators.length === 0 ? (
            <p style={s.empty}>No collaborators yet. Share the link and approve requests.</p>
          ) : (
            collaborators.map((c) => {
              const onlineUser = onlineUsers.find((u) => u.socketId !== "me" && c._id === c._id);
              const isOnline = onlineUsers.some((u) => u.name === c.name && u.socketId !== "me");
              const onlineEntry = onlineUsers.find((u) => u.name === c.name && u.socketId !== "me");
              return (
                <div key={c._id} style={s.item}>
                  <div style={{ position: "relative" }}>
                    <div style={{ ...s.dot, background: c.cursorColor || "#6366f1" }}>
                      {c.name[0].toUpperCase()}
                    </div>
                    {isOnline && <span style={s.onlineDot} />}
                  </div>
                  <div style={s.info}>
                    <p style={s.name}>{c.name}</p>
                    <p style={s.email}>{c.email}</p>
                  </div>
                  {isOnline && onlineEntry && (
                    <button style={s.kickBtn} onClick={() => onKick(onlineEntry.socketId)}>Kick</button>
                  )}
                  <button style={s.removeBtn} onClick={() => handleRemove(c._id)}>Remove</button>
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
  item: { display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "8px", background: "var(--bg-subtle)", border: "1px solid var(--border)" },
  dot: { width: "30px", height: "30px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#fff", flexShrink: 0 },
  info: { flex: 1, overflow: "hidden" },
  name: { margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--text-h)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  reqName: { margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--text-h)", flex: 1 },
  email: { margin: 0, fontSize: "11px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  approveBtn: { padding: "4px 10px", borderRadius: "6px", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "12px", fontFamily: "var(--sans)", flexShrink: 0 },
  denyBtn: { padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "12px", fontFamily: "var(--sans)", flexShrink: 0 },
  removeBtn: { padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "12px", fontFamily: "var(--sans)", flexShrink: 0 },
  kickBtn: { padding: "4px 10px", borderRadius: "6px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "12px", fontFamily: "var(--sans)", flexShrink: 0 },
  onlineDot: { position: "absolute", bottom: 0, right: 0, width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", border: "2px solid var(--bg)" } as React.CSSProperties,
  error: { margin: 0, fontSize: "13px", color: "#ef4444" },
  empty: { margin: 0, fontSize: "13px", color: "var(--text)", lineHeight: "1.5" },
};
