import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

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
      const res = await fetch("http://localhost:5000/api/auth/login", {
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
      const meRes = await fetch("http://localhost:5000/api/auth/me", { credentials: "include" });
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
      const res = await fetch("http://localhost:5000/api/auth/guest", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) { setError("Failed to start guest session"); setLoading(false); return; }
      const meRes = await fetch("http://localhost:5000/api/auth/me", { credentials: "include" });
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
        <h2>Login</h2>
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
          <span>or</span>
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
  container: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" },
  card: { background: "var(--code-bg)", border: "1px solid var(--border)", borderRadius: "12px", padding: "40px", width: "100%", maxWidth: "400px" },
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  input: { padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-h)", fontSize: "16px" },
  button: { padding: "10px", borderRadius: "8px", border: "none", background: "var(--accent)", color: "#fff", fontSize: "16px", cursor: "pointer" },
  demoBtn: { width: "100%", padding: "10px", borderRadius: "8px", border: "2px dashed var(--accent)", background: "var(--accent-bg)", color: "var(--accent)", fontSize: "15px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" },
  divider: { display: "flex", alignItems: "center", gap: "12px", margin: "12px 0", color: "var(--text)", fontSize: "13px" },
  link: { marginTop: "16px", fontSize: "14px", color: "var(--text)" },
  error: { color: "#ef4444", fontSize: "14px", margin: 0 },
};
