import { NavLink, useNavigate } from "react-router-dom";

const navItems = [
  { to: "/overview", label: "Overview", icon: "◉" },
  { to: "/live-queue", label: "Live Queue", icon: "◎" },
  { to: "/completed-queue", label: "Completed", icon: "✓" },
  { to: "/create-token", label: "Create Token", icon: "+" },
  { to: "/patient-records", label: "Patient Records", icon: "▤" },
  { to: "/department-analytics", label: "Analytics", icon: "◫" }
];

export const ClinicalShell = ({ children, pageTitle = "Clinical Curator" }) => {
  const navigate = useNavigate();
  const role = localStorage.getItem("auth_role") ?? "staff";

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_role");
    navigate("/login");
  };

  return (
    <>
      <aside className="cc-sidebar" aria-label="Main navigation">
        <div className="cc-sidebar-brand">
          <div className="cc-sidebar-logo">CC</div>
          <div>
            <h4>Clinical Curator</h4>
            <p>KMCH · Queue Ops</p>
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {navItems.map((item) => (
            <div key={item.to} className="cc-nav-link-wrap">
              <NavLink
                to={item.to}
                className={({ isActive }) => `cc-nav-link ${isActive ? "active" : ""}`}
              >
                <span className="cc-nav-icon" aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="cc-sidebar-footer">
          <button type="button" className="cc-btn cc-btn--primary" style={{ width: "100%" }} onClick={() => navigate("/create-token")}>
            New admission
          </button>
          <div className="cc-user-pill">
            <span className="cc-user-avatar">{String(role).slice(0, 2).toUpperCase()}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{role}</div>
              <div style={{ fontSize: 11, color: "var(--cc-text-muted)" }}>Signed in</div>
            </div>
          </div>
          <button type="button" className="cc-btn cc-btn--ghost" style={{ width: "100%" }} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <header className="cc-topbar">
        <p className="cc-topbar-title">
          <strong>{pageTitle}</strong>
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input className="cc-log-search" placeholder="Search patients…" style={{ width: 220, margin: 0 }} />
          <span className="cc-badge cc-badge--primary">{role}</span>
        </div>
      </header>
      <main className="cc-app-main">{children}</main>
    </>
  );
};
