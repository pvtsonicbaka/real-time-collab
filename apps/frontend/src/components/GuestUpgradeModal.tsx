import { useNavigate } from "react-router-dom";

interface Props {
  reason?: string;
  onClose: () => void;
}

export default function GuestUpgradeModal({ reason = "This action", onClose }: Props) {
  const navigate = useNavigate();

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <p style={s.icon}>👤</p>
        <h3 style={s.title}>Account Required</h3>
        <p style={s.desc}>
          <strong>{reason}</strong> requires a free account. Guest sessions are
          temporary — sign up to keep your work and get email notifications.
        </p>
        <div style={s.actions}>
          <button style={s.registerBtn} onClick={() => navigate("/register")}>
            Create Free Account
          </button>
          <button style={s.loginBtn} onClick={() => navigate("/login")}>
            Log In
          </button>
        </div>
        <button style={s.closeBtn} onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000,
  },
  card: {
    background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "16px",
    padding: "40px 36px", maxWidth: "400px", width: "100%",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
    textAlign: "center",
  },
  icon: { fontSize: "40px", margin: 0 },
  title: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-h)" },
  desc: { margin: 0, fontSize: "14px", color: "var(--text)", lineHeight: "1.6" },
  actions: { display: "flex", gap: "10px", width: "100%", marginTop: "4px" },
  registerBtn: {
    flex: 1, padding: "10px", borderRadius: "8px", border: "none",
    background: "var(--accent)", color: "#fff", fontSize: "14px",
    fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)",
  },
  loginBtn: {
    flex: 1, padding: "10px", borderRadius: "8px",
    border: "1px solid var(--accent)", background: "var(--accent-bg)",
    color: "var(--accent)", fontSize: "14px", fontWeight: 600,
    cursor: "pointer", fontFamily: "var(--sans)",
  },
  closeBtn: {
    background: "transparent", border: "none", color: "var(--text)",
    fontSize: "13px", cursor: "pointer", fontFamily: "var(--sans)",
  },
};
