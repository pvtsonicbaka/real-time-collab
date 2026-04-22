import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function InvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("");

  const token = params.get("token");

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      // save token in sessionStorage and redirect to login
      if (token) sessionStorage.setItem("inviteToken", token);
      navigate("/login");
      return;
    }
    if (!token) {
      setStatus("error");
      setMessage("Invalid invite link.");
      return;
    }
    accept(token);
  }, [isAuthenticated, isLoading]);

  const accept = async (t: string) => {
    try {
      const res = await fetch("http://localhost:5000/api/documents/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: t }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setTimeout(() => navigate(`/editor/${data.docId}`), 1500);
      } else {
        setStatus("error");
        setMessage(data.message || "Failed to accept invite.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong.");
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>CollabDocs</div>
        {status === "pending" && <p style={s.text}>Accepting invite...</p>}
        {status === "success" && <p style={{ ...s.text, color: "#22c55e" }}>✅ Invite accepted! Redirecting...</p>}
        {status === "error" && <p style={{ ...s.text, color: "#ef4444" }}>❌ {message}</p>}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" },
  card: { background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "12px", padding: "40px", textAlign: "center", minWidth: "300px" },
  logo: { fontSize: "20px", fontWeight: 700, color: "var(--accent)", marginBottom: "16px" },
  text: { margin: 0, fontSize: "15px", color: "var(--text)" },
};
