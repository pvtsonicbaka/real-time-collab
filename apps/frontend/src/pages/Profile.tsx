import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { colorFromId } from "../utils/color";

export default function Profile() {
  const { user, updateProfile } = useAuthStore();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const cursorColor = user?._id ? colorFromId(user._id) : "#6366f1";

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({ name });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={s.page}>
      <div style={s.container}>

        <div style={s.header}>
          <button style={s.backBtn} onClick={() => navigate("/dashboard")}>← Back</button>
          <h2 style={s.title}>Profile</h2>
        </div>

        {/* Avatar */}
        <div style={s.avatarSection}>
          <div style={{ ...s.avatar, background: cursorColor }}>
            {name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p style={s.avatarName}>{name}</p>
            <p style={s.avatarEmail}>{user?.email}</p>
          </div>
        </div>

        {/* Name */}
        <div style={s.field}>
          <label style={s.label}>Display Name</label>
          <input
            style={s.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        {/* Cursor color — auto generated, just show it */}
        <div style={s.field}>
          <label style={s.label}>Cursor Color</label>
          <p style={s.hint}>Auto-generated from your account — unique to you</p>
          <div style={s.colorRow}>
            <div style={{ ...s.colorDot, background: cursorColor }} />
            <span style={s.colorText}>{cursorColor}</span>
          </div>
        </div>

        <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--bg-subtle)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 24px" },
  container: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "24px" },
  header: { display: "flex", alignItems: "center", gap: "16px" },
  backBtn: { padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "14px", fontFamily: "var(--sans)" },
  title: { margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-h)" },
  avatarSection: { display: "flex", alignItems: "center", gap: "16px", padding: "16px", background: "var(--bg-subtle)", borderRadius: "12px", border: "1px solid var(--border)" },
  avatar: { width: "56px", height: "56px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 700, color: "#fff", flexShrink: 0 },
  avatarName: { margin: "0 0 2px", fontWeight: 600, color: "var(--text-h)", fontSize: "16px" },
  avatarEmail: { margin: 0, fontSize: "13px", color: "var(--text)" },
  field: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { fontSize: "13px", fontWeight: 600, color: "var(--text-h)" },
  hint: { margin: 0, fontSize: "12px", color: "var(--text)" },
  input: { padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--code-bg)", color: "var(--text-h)", fontSize: "15px", fontFamily: "var(--sans)", outline: "none" },
  colorRow: { display: "flex", alignItems: "center", gap: "10px" },
  colorDot: { width: "28px", height: "28px", borderRadius: "50%", border: "1px solid var(--border)", flexShrink: 0 },
  colorText: { fontSize: "13px", color: "var(--text)", fontFamily: "var(--mono)" },
  saveBtn: { padding: "10px", borderRadius: "8px", border: "none", background: "var(--accent)", color: "#fff", fontSize: "15px", fontWeight: 500, cursor: "pointer", fontFamily: "var(--sans)" },
};
