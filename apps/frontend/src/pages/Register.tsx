import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_URL } from "../utils/api";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return setError(data.message);
      }

      setSuccess("Account created! Redirecting...");
      setTimeout(() => navigate("/login"), 1500);
    } catch {
      setError("Something went wrong");
    }
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
        <h2 style={styles.heading}>Create your account</h2>
        <form onSubmit={handleRegister} style={styles.form}>
          <input
            style={styles.input}
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
          {success && <p style={styles.success}>{success}</p>}
          <button style={styles.button} type="submit">
            Register
          </button>
        </form>
        <p style={styles.link}>
          Already have an account? <Link to="/login">Login</Link>
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
  error: { color: "#ef4444", fontSize: "13px", margin: 0 },
  success: { color: "#16a34a", fontSize: "13px", margin: 0 },
  link: { marginTop: "16px", fontSize: "14px", color: "var(--text)", textAlign: "center" },
};
