import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useDocuments } from "../hooks/useDocuments";
import { useThemeStore, themes } from "../store/themeStore";
import CreateDocModal from "../components/CreateDocModal";
import { API_URL } from "../utils/api";

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [showModal, setShowModal] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [restoredBanner, setRestoredBanner] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { docs, loading, hasMore, loadMore, addDoc, removeDoc } = useDocuments(search);
  const loaderRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 400);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("restored") === "1") {
      setRestoredBanner(true);
      window.history.replaceState({}, "", "/dashboard");
      setTimeout(() => setRestoredBanner(false), 5000);
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) loadMore();
      },
      { threshold: 1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/api/documents/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    removeDoc(id);
  };

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <div style={s.brand}>
            <div style={s.brandLogo}>C</div>
            <span style={s.brandName}>CollabDocs</span>
          </div>

          <div style={s.userBox} onClick={() => navigate("/profile")} title="Edit Profile">
            <div style={s.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
            <div style={s.userInfo}>
              <p style={s.userName}>{user?.name}</p>
              <p style={s.userEmail}>{user?.email}</p>
            </div>
          </div>

          <div style={s.navSection}>
            <p style={s.navLabel}>Workspace</p>
            <div style={{ ...s.navItem, ...s.navItemActive }}>
              <span>🗂</span> All Documents
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div style={s.sidebarBottom}>
          {/* Theme Picker */}
          <div style={s.themeSection}>
            <p style={s.navLabel}>Theme</p>
            <div style={s.themePicker}>
              {themes.map((t) => (
                <button
                  key={t.key}
                  title={t.label}
                  onClick={() => setTheme(t.key)}
                  style={{
                    ...s.themeBtn,
                    background: t.bg,
                    borderColor: theme === t.key ? t.accent : "var(--border)",
                    boxShadow: theme === t.key ? `0 0 0 2px ${t.accent}` : "none",
                  }}
                >
                  <span style={{ ...s.themeBtnDot, background: t.accent }} />
                </button>
              ))}
            </div>
          </div>

          <button style={s.logoutBtn} onClick={logout}>
            ↩ Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={s.main}>
        {restoredBanner && (
          <div style={s.restoredBanner}>
            🔄 The document was restored to a previous version. You can reopen it below.
          </div>
        )}
        <div style={s.topBar}>
          <div>
            <h2 style={s.pageTitle}>All Documents</h2>
            <p style={s.pageSubtitle}>
              {search ? `Results for "${search}"` : `${docs.length} document${docs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={s.searchBox}>
              <span style={s.searchIcon}>🔍</span>
              <input
                style={s.searchInput}
                placeholder="Search documents..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              {searchInput && (
                <button style={s.searchClear} onClick={() => { setSearchInput(""); setSearch(""); }}>✕</button>
              )}
            </div>
            <button style={s.newBtn} onClick={() => setShowModal(true)}>+ New Document</button>
          </div>
        </div>

        {docs.length === 0 && !loading ? (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>{search ? "🔍" : "📄"}</div>
            <p style={s.emptyTitle}>{search ? `No results for "${search}"` : "No documents yet"}</p>
            <p style={s.emptySubtitle}>{search ? "Try a different search term" : "Create your first document to get started"}</p>
            {!search && <button style={s.newBtn} onClick={() => setShowModal(true)}>+ New Document</button>}
          </div>
        ) : (
          <div style={s.grid}>
            {docs.map((doc) => {
              const isHovered = hoveredId === doc._id;
              const preview = stripHtml(doc.content);
              const wordCount = preview ? preview.split(/\s+/).filter(Boolean).length : 0;

              return (
                <div
                  key={doc._id}
                  style={{
                    ...s.card,
                    borderColor: isHovered ? "var(--accent)" : "var(--border)",
                    boxShadow: isHovered ? "var(--shadow-md)" : "var(--shadow)",
                    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                  }}
                  onMouseEnter={() => setHoveredId(doc._id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Card header */}
                  <div style={s.cardHeader}>
                    <div style={s.docIconWrap}>📄</div>
                    <div style={s.cardMeta}>
                      <p style={s.docTitle}>{doc.title}</p>
                      <p style={s.docDate}>
                        {new Date(doc.updatedAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Preview */}
                  <p style={s.docPreview}>
                    {preview ? preview.slice(0, 120) : "No content yet — click Open to start writing."}
                  </p>

                  {/* Footer */}
                  <div style={s.cardFooter}>
                    <span style={s.wordCount}>{wordCount} words</span>
                    <div style={s.cardActions}>
                      {doc.owner === user?._id && (
                        <button style={s.deleteBtn} onClick={() => handleDelete(doc._id)}>
                          Delete
                        </button>
                      )}
                      <button style={s.openBtn} onClick={() => navigate(`/editor/${doc._id}`)}>
                        Open →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div ref={loaderRef} style={{ height: "20px" }} />
        {loading && <p style={s.loadingText}>Loading...</p>}
      </main>

      {showModal && (
        <CreateDocModal onClose={() => setShowModal(false)} onCreated={addDoc} />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { display: "flex", minHeight: "100vh", background: "var(--bg-subtle)", textAlign: "left" },

  // sidebar
  sidebar: { width: "260px", minWidth: "260px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "24px 16px", gap: "auto", background: "var(--bg)" },
  sidebarTop: { display: "flex", flexDirection: "column", gap: "20px", flex: 1 },
  brand: { display: "flex", alignItems: "center", gap: "8px", padding: "0 8px" },
  brandLogo: { width: "32px", height: "32px", borderRadius: "8px", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 700 },
  brandName: { fontSize: "17px", fontWeight: 700, color: "var(--text-h)", letterSpacing: "-0.3px" },
  userBox: { display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "8px", background: "var(--bg-subtle)", border: "1px solid var(--border)", cursor: "pointer" },
  avatar: { width: "34px", height: "34px", borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, flexShrink: 0 },
  userInfo: { overflow: "hidden" },
  userName: { margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--text-h)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userEmail: { margin: 0, fontSize: "11px", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  navSection: { display: "flex", flexDirection: "column", gap: "4px" },
  navLabel: { margin: "0 0 4px 8px", fontSize: "11px", fontWeight: 600, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.6px" },
  navItem: { display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderRadius: "6px", fontSize: "14px", color: "var(--text)", cursor: "pointer" },
  navItemActive: { background: "var(--accent-bg)", color: "var(--accent)", fontWeight: 500 },
  sidebarBottom: { display: "flex", flexDirection: "column", gap: "12px", paddingTop: "16px", borderTop: "1px solid var(--border)" },
  themeSection: { display: "flex", flexDirection: "column", gap: "8px" },
  themePicker: { display: "flex", flexWrap: "wrap", gap: "6px", padding: "4px 0" },
  themeBtn: { width: "22px", height: "22px", borderRadius: "50%", cursor: "pointer", transition: "box-shadow 0.15s", padding: "3px", border: "1px solid var(--border)" },
  themeBtnDot: { width: "100%", height: "100%", borderRadius: "50%", display: "block" },

  logoutBtn: { padding: "9px 12px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "14px", textAlign: "left", fontFamily: "var(--sans)" },

  // main
  main: { flex: 1, padding: "32px 40px", overflowY: "auto" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" },
  pageTitle: { margin: "0 0 2px", fontSize: "22px", fontWeight: 700, color: "var(--text-h)", letterSpacing: "-0.4px" },
  pageSubtitle: { margin: 0, fontSize: "13px", color: "var(--text)" },
  newBtn: { padding: "7px 14px", borderRadius: "7px", border: "none", background: "var(--accent)", color: "#fff", fontSize: "13px", cursor: "pointer", fontWeight: 500, fontFamily: "var(--sans)", whiteSpace: "nowrap" },

  // empty
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "80px" },
  emptyIcon: { fontSize: "40px" },
  emptyTitle: { margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--text-h)" },
  emptySubtitle: { margin: "0 0 12px", fontSize: "13px", color: "var(--text)" },

  // grid
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" },

  // card
  card: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s" },
  cardHeader: { display: "flex", alignItems: "flex-start", gap: "12px" },
  docIconWrap: { fontSize: "22px", flexShrink: 0, marginTop: "1px" },
  cardMeta: { flex: 1, overflow: "hidden" },
  docTitle: { margin: "0 0 4px", fontWeight: 600, color: "var(--text-h)", fontSize: "15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  docDate: { margin: 0, fontSize: "12px", color: "var(--text)" },
  docPreview: { margin: 0, fontSize: "13px", color: "var(--text)", lineHeight: "1.6", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" },
  cardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid var(--border)", marginTop: "auto" },
  wordCount: { fontSize: "12px", color: "var(--text)" },
  cardActions: { display: "flex", gap: "6px" },
  openBtn: { padding: "5px 14px", borderRadius: "6px", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 500, fontFamily: "var(--sans)" },
  deleteBtn: { padding: "5px 14px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "13px", fontFamily: "var(--sans)" },

  loadingText: { textAlign: "center", color: "var(--text)", fontSize: "13px", marginTop: "16px" },
  restoredBanner: { background: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a", borderRadius: "8px", padding: "10px 16px", fontSize: "13px", marginBottom: "16px" },
  searchBox: { display: "flex", alignItems: "center", gap: "6px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px", width: "220px" },
  searchIcon: { fontSize: "13px", flexShrink: 0 },
  searchInput: { flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--text-h)", fontSize: "13px", fontFamily: "var(--sans)" },
  searchClear: { background: "transparent", border: "none", cursor: "pointer", color: "var(--text)", fontSize: "13px", padding: 0, flexShrink: 0 },
};
