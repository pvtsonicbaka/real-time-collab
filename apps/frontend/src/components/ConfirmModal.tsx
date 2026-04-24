interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title, message, confirmLabel = "Confirm", cancelLabel = "Cancel",
  danger = false, onConfirm, onCancel,
}: Props) {
  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <h3 style={s.title}>{title}</h3>
        <p style={s.message}>{message}</p>
        <div style={s.actions}>
          <button style={s.cancelBtn} onClick={onCancel}>{cancelLabel}</button>
          <button
            style={{ ...s.confirmBtn, background: danger ? "#ef4444" : "var(--accent)" }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  card: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "14px", padding: "28px 32px", maxWidth: "380px", width: "100%", display: "flex", flexDirection: "column", gap: "12px" },
  title: { margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--text-h)" },
  message: { margin: 0, fontSize: "14px", color: "var(--text)", lineHeight: "1.6" },
  actions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" },
  cancelBtn: { padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "14px", fontFamily: "var(--sans)" },
  confirmBtn: { padding: "8px 18px", borderRadius: "8px", border: "none", color: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 600, fontFamily: "var(--sans)" },
};
