import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { API_URL } from "../utils/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const doLogin = async (e: string, p: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: e, password: p }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message);
        setLoading(false);
        return;
      }
      const meRes = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
      const user = await meRes.json();
      setAuth(user);
      const inviteToken = sessionStorage.getItem("inviteToken");
      if (inviteToken) {
        sessionStorage.removeItem("inviteToken");
        navigate(`/invite?token=${inviteToken}`);
      } else {
        navigate("/dashboard");
      }
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(email, password);
  };

  const handleDemo = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/guest`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) { setError("Failed to start guest session"); setLoading(false); return; }
      const meRes = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
      const user = await meRes.json();
      setAuth(user);
      navigate("/dashboard");
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <img src="/logo1.jpg" alt="CollabDocs" style={styles.brandImg} />
          <div>
            <h1 style={styles.brandName}>CollabDocs</h1>
            <p style={styles.brandTagline}>Real-time collaborative editing</p>
          </div>
        </div>
        <h2 style={styles.heading}>Welcome back</h2>
        <form onSubmit={handleLogin} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span>or</span>
          <div style={styles.dividerLine} />
        </div>
        <button style={styles.demoBtn} onClick={handleDemo} disabled={loading}>
          👤 Continue as Guest — no signup needed
        </button>
        <p style={styles.link}>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--bg-subtle)" },
  card: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "16px", padding: "40px", width: "100%", maxWidth: "420px", boxShadow: "var(--shadow-md)" },
  brand: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px", paddingBottom: "24px", borderBottom: "1px solid var(--border)" },
  brandImg: { width: "88px", height: "88px", borderRadius: "14px", objectFit: "cover" as const },
  brandName: { margin: 0, fontSize: "20px", fontWeight: 800, color: "var(--text-h)", letterSpacing: "-0.5px" },
  brandTagline: { margin: 0, fontSize: "12px", color: "var(--text)" },
  heading: { margin: "0 0 20px", fontSize: "18px", fontWeight: 700, color: "var(--text-h)" },
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  input: { padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-h)", fontSize: "15px", outline: "none", fontFamily: "var(--sans)" },
  button: { padding: "11px", borderRadius: "8px", border: "none", background: "var(--accent)", color: "#fff", fontSize: "15px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" },
  demoBtn: { width: "100%", padding: "11px", borderRadius: "8px", border: "2px dashed var(--accent)", background: "var(--accent-bg)", color: "var(--accent)", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" },
  divider: { display: "flex", alignItems: "center", gap: "12px", margin: "12px 0", color: "var(--text)", fontSize: "13px" },
  dividerLine: { flex: 1, height: "1px", background: "var(--border)" },
  link: { marginTop: "16px", fontSize: "14px", color: "var(--text)", textAlign: "center" },
  error: { color: "#ef4444", fontSize: "13px", margin: 0 },
};
