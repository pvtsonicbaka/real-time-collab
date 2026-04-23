import { useEffect, useState } from "react";
import { API_URL } from "../utils/api";

export interface Version {
  _id: string;
  label: string;
  isManual: boolean;
  content: string;
  savedBy: { name: string } | null;
  createdAt: string;
}

interface Props {
  docId: string;
  isOwner: boolean;
  canSave: boolean; // owner or editor
  onPreview: (version: Version) => void;
  onRestore: (version: Version) => void;
  onClose: () => void;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "TODAY";
  if (d.toDateString() === yesterday.toDateString()) return "YESTERDAY";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

export default function VersionHistory({ docId, isOwner, canSave, onPreview, onRestore, onClose }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [showLabelInput, setShowLabelInput] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/documents/${docId}/versions`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setVersions(data); setLoading(false); });
  }, [docId]);

  const handleManualSave = async () => {
    setSaving(true);
    const res = await fetch(`${API_URL}/api/documents/${docId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ label: label.trim() || "Manual save" }),
    });
    const data = await res.json();
    if (res.ok) {
      setVersions((prev) => [data, ...prev]);
      setLabel("");
      setShowLabelInput(false);
    }
    setSaving(false);
  };

  // group versions by day
  const grouped: { day: string; items: Version[] }[] = [];
  for (const v of versions) {
    const day = dayLabel(v.createdAt);
    const existing = grouped.find((g) => g.day === day);
    if (existing) existing.items.push(v);
    else grouped.push({ day, items: [v] });
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>🕐 Version History</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {canSave && (
          <div style={s.saveSection}>
            {showLabelInput ? (
              <div style={s.labelRow}>
                <input
                  style={s.labelInput}
                  placeholder="Version label (optional)"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSave()}
                  autoFocus
                />
                <button style={s.saveBtn} onClick={handleManualSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button style={s.cancelBtn} onClick={() => setShowLabelInput(false)}>✕</button>
              </div>
            ) : (
              <button style={s.newSaveBtn} onClick={() => setShowLabelInput(true)}>
                + Save Version
              </button>
            )}
          </div>
        )}

        <div style={s.list}>
          {loading && <p style={s.empty}>Loading...</p>}
          {!loading && versions.length === 0 && (
            <p style={s.empty}>No versions yet. Versions are auto-saved every 30s while editing.</p>
          )}
          {grouped.map((group) => (
            <div key={group.day}>
              <p style={s.dayLabel}>{group.day}</p>
              {group.items.map((v) => (
                <div key={v._id} style={s.item}>
                  <div style={s.itemLeft}>
                    <span style={s.icon}>{v.isManual ? "🔖" : "⚡"}</span>
                    <div>
                      <p style={s.itemLabel}>{v.isManual ? (v.label || "Manual save") : "Auto-save"}</p>
                      <p style={s.itemMeta}>
                        {v.savedBy?.name ?? "Unknown"} · {timeAgo(v.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div style={s.actions}>
                    <button style={s.previewBtn} onClick={() => onPreview(v)}>Preview</button>
                    {isOwner && (
                      <button style={s.restoreBtn} onClick={() => onRestore(v)}>Restore</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)", zIndex: 50, display: "flex", justifyContent: "flex-end" },
  panel: { background: "var(--bg)", borderLeft: "1px solid var(--border)", width: "340px", height: "100%", display: "flex", flexDirection: "column", padding: "24px", gap: "16px", overflowY: "auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  title: { margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-h)" },
  closeBtn: { background: "transparent", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--text)", padding: "4px" },
  saveSection: { flexShrink: 0 },
  newSaveBtn: { width: "100%", padding: "8px", borderRadius: "8px", border: "1px dashed var(--border)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "var(--sans)" },
  labelRow: { display: "flex", gap: "6px" },
  labelInput: { flex: 1, padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-h)", fontSize: "13px", fontFamily: "var(--sans)", outline: "none" },
  saveBtn: { padding: "7px 12px", borderRadius: "7px", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "var(--sans)", flexShrink: 0 },
  cancelBtn: { padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "12px", fontFamily: "var(--sans)", flexShrink: 0 },
  list: { display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto" },
  dayLabel: { margin: "8px 0 4px", fontSize: "10px", fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.6px" },
  item: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", borderRadius: "8px", background: "var(--bg-subtle)", border: "1px solid var(--border)", gap: "8px" },
  itemLeft: { display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" },
  icon: { fontSize: "16px", flexShrink: 0 },
  itemLabel: { margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--text-h)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  itemMeta: { margin: 0, fontSize: "11px", color: "var(--text)" },
  actions: { display: "flex", gap: "4px", flexShrink: 0 },
  previewBtn: { padding: "3px 8px", borderRadius: "5px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "11px", fontFamily: "var(--sans)" },
  restoreBtn: { padding: "3px 8px", borderRadius: "5px", border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: "11px", fontFamily: "var(--sans)" },
  empty: { margin: 0, fontSize: "13px", color: "var(--text)", lineHeight: "1.6" },
};
