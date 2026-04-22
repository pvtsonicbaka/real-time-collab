import { useState } from "react";
import { colorFromId } from "../utils/color";
import GuestUpgradeModal from "./GuestUpgradeModal";

export interface Reply {
  _id: string;
  authorId: { _id: string; name: string } | string;
  body: string;
  createdAt: string;
}

export interface Comment {
  _id: string;
  authorId: { _id: string; name: string } | string;
  anchorText: string;
  yRelativeFrom?: string;
  yRelativeTo?: string;
  color?: string;
  body: string;
  resolved: boolean;
  replies: Reply[];
  createdAt: string;
}

interface Props {
  docId: string;
  comments: Comment[];
  canComment: boolean;
  currentUserId: string;
  isOwner: boolean;
  isGuest?: boolean;
  activeCommentId: string | null;
  currentSelection: { from: number; to: number; text: string };
  onAdd: (body: string, anchorText: string) => void;
  onReply: (commentId: string, body: string) => void;
  onResolve: (commentId: string) => void;
  onReopen: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onSelect: (commentId: string | null) => void;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getAuthorName(authorId: Reply["authorId"]) {
  return typeof authorId === "object" ? authorId.name : "Unknown";
}

function getAuthorId(authorId: Reply["authorId"]) {
  return typeof authorId === "object" ? authorId._id : authorId;
}

export default function CommentsPanel({
  comments, canComment, currentUserId, isOwner, isGuest,
  activeCommentId, currentSelection, onAdd, onReply, onResolve, onReopen, onDelete, onSelect,
}: Props) {
  const [newBody, setNewBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  const guardGuest = (reason: string, action: () => void) => {
    if (isGuest) { setUpgradeReason(reason); return; }
    action();
  };

  const open = comments.filter(c => !c.resolved);
  const resolved = comments.filter(c => c.resolved);
  const visible = showResolved ? [...open, ...resolved] : open;

  const handleAdd = () => {
    if (!newBody.trim()) return;
    guardGuest("Posting comments", () => {
      onAdd(newBody.trim(), "");
      setNewBody("");
    });
  };

  const handleReply = (commentId: string) => {
    if (!replyBody.trim()) return;
    guardGuest("Replying to comments", () => {
      onReply(commentId, replyBody.trim());
      setReplyBody("");
      setReplyingTo(null);
    });
  };

  return (
    <div style={s.panel}>
      {upgradeReason && (
        <GuestUpgradeModal
          reason={upgradeReason}
          onClose={() => setUpgradeReason(null)}
        />
      )}
      <div style={s.header}>
        <span style={s.title}>💬 Comments</span>
        <span style={s.count}>{open.length}</span>
      </div>

      {canComment && (
        <div style={s.addBox}>
          {currentSelection.text && (
            <div style={s.selectionHint}>
              {`💬 Commenting on: "${currentSelection.text.slice(0, 50)}${currentSelection.text.length > 50 ? '\u2026' : ''}"`}
            </div>
          )}
          <textarea
            style={s.textarea}
            placeholder="Add a comment..."
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
            rows={2}
          />
          <button style={s.addBtn} onClick={handleAdd} disabled={!newBody.trim()}>
            Comment
          </button>
        </div>
      )}

      {visible.length === 0 && (
        <p style={s.empty}>
          {canComment ? "No comments yet. Select text or add a comment above." : "No comments yet."}
        </p>
      )}

      <div style={s.list}>
        {visible.map((c) => {
          const isActive = activeCommentId === c._id;
          const authorName = getAuthorName(c.authorId);
          const authorId = getAuthorId(c.authorId);
          const isAuthor = authorId === currentUserId;

          return (
            <div
              key={c._id}
              style={{ ...s.card, ...(isActive ? s.cardActive : {}), ...(c.resolved ? s.cardResolved : {}) }}
              onClick={() => onSelect(isActive ? null : c._id)}
            >
              {/* anchor text */}
              {c.anchorText && (
                <div style={s.anchor}>"{c.anchorText.slice(0, 60)}{c.anchorText.length > 60 ? "…" : ""}"</div>
              )}

              {/* comment header */}
              <div style={s.cardHeader}>
                <div style={{ ...s.avatar, background: colorFromId(authorId) }}>
                  {authorName[0]?.toUpperCase()}
                </div>
                <div style={s.meta}>
                  <span style={s.author}>{authorName}</span>
                  <span style={s.time}>{timeAgo(c.createdAt)}</span>
                </div>
                {c.resolved && <span style={s.resolvedBadge}>✓ Resolved</span>}
              </div>

              <p style={s.body}>{c.body}</p>

              {/* replies */}
              {c.replies.length > 0 && (
                <div style={s.replies}>
                  {c.replies.map((r) => (
                    <div key={r._id} style={s.reply}>
                      <div style={{ ...s.avatar, ...s.avatarSm, background: colorFromId(getAuthorId(r.authorId)) }}>
                        {getAuthorName(r.authorId)[0]?.toUpperCase()}
                      </div>
                      <div style={s.replyContent}>
                        <span style={s.replyAuthor}>{getAuthorName(r.authorId)}</span>
                        <span style={s.replyTime}>{timeAgo(r.createdAt)}</span>
                        <p style={s.replyBody}>{r.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* reply input */}
              {isActive && canComment && replyingTo === c._id && (
                <div style={s.replyBox} onClick={(e) => e.stopPropagation()}>
                  <textarea
                    style={{ ...s.textarea, ...s.replyTextarea }}
                    placeholder="Reply..."
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(c._id); } }}
                    rows={2}
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button style={s.addBtn} onClick={() => handleReply(c._id)} disabled={!replyBody.trim()}>Reply</button>
                    <button style={s.cancelBtn} onClick={() => { setReplyingTo(null); setReplyBody(""); }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* actions */}
              {isActive && (
                <div style={s.actions} onClick={(e) => e.stopPropagation()}>
                  {canComment && replyingTo !== c._id && (
                    <button style={s.actionBtn} onClick={() => setReplyingTo(c._id)}>↩ Reply</button>
                  )}
                  {!c.resolved && (isOwner || isAuthor) && (
                    <button style={s.actionBtn} onClick={() => onResolve(c._id)}>✓ Resolve</button>
                  )}
                  {c.resolved && (isOwner || isAuthor) && (
                    <button style={s.actionBtn} onClick={() => onReopen(c._id)}>↺ Reopen</button>
                  )}
                  {(isOwner || isAuthor) && (
                    <button style={{ ...s.actionBtn, ...s.deleteBtn }} onClick={() => onDelete(c._id)}>✕</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {resolved.length > 0 && (
        <button style={s.toggleResolved} onClick={() => setShowResolved(v => !v)}>
          {showResolved ? "Hide" : "Show"} {resolved.length} resolved
        </button>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  panel: { width: "280px", minWidth: "280px", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "12px", padding: "20px 16px", overflowY: "auto", background: "var(--bg)", height: "100%" },
  header: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  title: { fontSize: "14px", fontWeight: 700, color: "var(--text-h)" },
  count: { fontSize: "11px", fontWeight: 700, background: "var(--accent)", color: "#fff", borderRadius: "10px", padding: "1px 7px" },
  addBox: { display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 },
  selectionHint: { fontSize: "11px", color: "var(--accent)", background: "var(--accent-bg)", borderLeft: "2px solid var(--accent)", padding: "3px 7px", borderRadius: "3px", fontStyle: "normal" },
  textarea: { width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-h)", fontSize: "13px", fontFamily: "var(--sans)", resize: "none", outline: "none", boxSizing: "border-box" },
  replyTextarea: { fontSize: "12px" },
  addBtn: { padding: "6px 14px", borderRadius: "6px", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "var(--sans)", alignSelf: "flex-end" },
  cancelBtn: { padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "12px", fontFamily: "var(--sans)" },
  list: { display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" },
  empty: { margin: 0, fontSize: "12px", color: "var(--text)", lineHeight: "1.6" },
  card: { padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-subtle)", cursor: "pointer", display: "flex", flexDirection: "column", gap: "6px", transition: "border-color 0.15s" },
  cardActive: { borderColor: "var(--accent)", background: "var(--accent-bg)" },
  cardResolved: { opacity: 0.6 },
  anchor: { fontSize: "11px", color: "var(--accent)", background: "var(--accent-bg)", borderLeft: "2px solid var(--accent)", padding: "3px 7px", borderRadius: "3px", fontStyle: "italic" },
  cardHeader: { display: "flex", alignItems: "center", gap: "6px" },
  avatar: { width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#fff", flexShrink: 0 },
  avatarSm: { width: "18px", height: "18px", fontSize: "9px" },
  meta: { flex: 1, display: "flex", flexDirection: "column" },
  author: { fontSize: "12px", fontWeight: 600, color: "var(--text-h)" },
  time: { fontSize: "10px", color: "var(--text)" },
  resolvedBadge: { fontSize: "10px", color: "#16a34a", fontWeight: 600, background: "#dcfce7", padding: "1px 6px", borderRadius: "4px" },
  body: { margin: 0, fontSize: "13px", color: "var(--text-h)", lineHeight: "1.5" },
  replies: { display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "8px", borderLeft: "2px solid var(--border)" },
  reply: { display: "flex", gap: "6px", alignItems: "flex-start" },
  replyContent: { display: "flex", flexDirection: "column", gap: "2px" },
  replyAuthor: { fontSize: "11px", fontWeight: 600, color: "var(--text-h)" },
  replyTime: { fontSize: "10px", color: "var(--text)", marginLeft: "4px" },
  replyBody: { margin: 0, fontSize: "12px", color: "var(--text-h)", lineHeight: "1.4" },
  replyBox: { display: "flex", flexDirection: "column", gap: "6px" },
  actions: { display: "flex", gap: "4px", flexWrap: "wrap" },
  actionBtn: { padding: "3px 8px", borderRadius: "5px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "11px", fontFamily: "var(--sans)" },
  deleteBtn: { color: "#ef4444", borderColor: "#ef4444" },
  toggleResolved: { padding: "6px", borderRadius: "6px", border: "1px dashed var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "11px", fontFamily: "var(--sans)", flexShrink: 0 },
};
