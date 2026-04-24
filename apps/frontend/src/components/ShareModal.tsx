import { useState } from "react";

interface Props {
  url: string;
  docTitle: string;
  onClose: () => void;
}

export default function ShareModal({ url, docTitle, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>🔗 Share Document</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p style={s.docName}>{docTitle}</p>

        <div style={s.urlRow}>
          <input style={s.urlInput} value={url} readOnly />
          <button style={{ ...s.copyBtn, background: copied ? "#22c55e" : "var(--accent)" }} onClick={handleCopy}>
            {copied ? "✓ Copied!" : "Copy"}
          </button>
        </div>

        <p style={s.hint}>
          Anyone with this link can request access to this document.
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  card: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "14px", padding: "28px 32px", maxWidth: "440px", width: "100%", display: "flex", flexDirection: "column", gap: "16px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--text-h)" },
  closeBtn: { background: "transparent", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--text)", padding: "4px" },
  docName: { margin: 0, fontSize: "13px", color: "var(--text)", background: "var(--bg-subtle)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  urlRow: { display: "flex", gap: "8px" },
  urlInput: { flex: 1, padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text)", fontSize: "13px", fontFamily: "var(--mono)", outline: "none", overflow: "hidden", textOverflow: "ellipsis" },
  copyBtn: { padding: "9px 18px", borderRadius: "8px", border: "none", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)", transition: "background 0.2s", whiteSpace: "nowrap" },
  hint: { margin: 0, fontSize: "12px", color: "var(--text)", lineHeight: "1.5" },
};
