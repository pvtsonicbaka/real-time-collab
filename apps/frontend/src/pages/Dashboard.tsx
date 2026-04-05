import { useAuthStore } from "../store/authStore";

export default function Dashboard() {
  const { user, logout } = useAuthStore();

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Dashboard 🔒</h2>
        <p style={styles.welcome}>Welcome, <strong>{user?.name}</strong></p>
        <p style={styles.email}>{user?.email}</p>
        <button style={styles.button} onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" },
  card: { background: "var(--code-bg)", border: "1px solid var(--border)", borderRadius: "12px", padding: "40px", width: "100%", maxWidth: "400px" },
  welcome: { fontSize: "18px", margin: "8px 0" },
  email: { color: "var(--text)", fontSize: "14px", marginBottom: "24px" },
  button: { padding: "10px 20px", borderRadius: "8px", border: "none", background: "var(--accent)", color: "#fff", fontSize: "16px", cursor: "pointer" },
};
