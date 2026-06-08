import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { APP_NAME, APP_SHORT, APP_TAGLINE } from "../../constants/brand.js";
import { NavIcons } from "./NavIcons.jsx";

const navItems = [
  { to: "/overview", label: "Overview", iconKey: "overview" },
  { to: "/create-token", label: "Create Token", iconKey: "create" },
  { to: "/live-queue", label: "Live Queue", iconKey: "queue" },
  { to: "/completed-queue", label: "Completed", iconKey: "completed" },
  { to: "/patient-records", label: "Patient Records", iconKey: "records" },
  { to: "/infographic", label: "Infographic", iconKey: "infographic" }
];

const THEME_KEY = "nexaflow_theme";
const SIDEBAR_KEY = "nexaflow_sidebar_collapsed";

export const ClinicalShell = ({ children, pageTitle = APP_NAME }) => {
  const navigate = useNavigate();
  const role = localStorage.getItem("auth_role") ?? "staff";
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) === "dark");

  useEffect(() => {
    document.body.classList.toggle("cc-sidebar-collapsed", collapsed);
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.body.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 1024) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("cc-mobile-nav-open", mobileOpen);
    return () => document.body.classList.remove("cc-mobile-nav-open");
  }, [mobileOpen]);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_role");
    navigate("/login");
  };

  return (
    <>
      <div
        className="nf-sidebar-backdrop"
        role="presentation"
        onClick={() => setMobileOpen(false)}
      />
      <aside className="cc-sidebar" aria-label="Main navigation">
        <div className="cc-sidebar-brand">
          <div className="cc-sidebar-logo">{APP_SHORT}</div>
          <div className="cc-sidebar-brand-text">
            <h4>{APP_NAME}</h4>
            <p>{APP_TAGLINE}</p>
          </div>
          <button
            type="button"
            className="nf-icon-btn nf-sidebar-toggle cc-nav-collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {NavIcons.chevron}
          </button>
        </div>
        <nav className="cc-sidebar-nav">
          {navItems.map((item) => (
            <div key={item.to} className="cc-nav-link-wrap">
              <NavLink
                to={item.to}
                className={({ isActive }) => `cc-nav-link ${isActive ? "active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                <span className="cc-nav-icon">{NavIcons[item.iconKey]}</span>
                <span>{item.label}</span>
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="cc-sidebar-footer">
          <div className="cc-user-pill">
            <span className="cc-user-avatar">{String(role).slice(0, 2).toUpperCase()}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{role}</div>
              <div style={{ fontSize: 11, color: "var(--nf-text-muted)" }}>Signed in</div>
            </div>
          </div>
          <button
            type="button"
            className="cc-btn cc-btn--ghost cc-sign-out-btn"
            onClick={handleLogout}
            aria-label="Sign out"
          >
            <span className="cc-sign-out-icon" aria-hidden="true">
              {NavIcons.logout}
            </span>
            <span className="cc-btn-label">Sign out</span>
          </button>
        </div>
      </aside>

      <header className="cc-topbar">
        <div className="cc-topbar-left">
          <button
            type="button"
            className="nf-icon-btn nf-mobile-menu-btn"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Open menu"
          >
            {NavIcons.menu}
          </button>
          <p className="cc-topbar-title">
            <strong>{pageTitle}</strong>
          </p>
        </div>
        <div className="nf-topbar-actions">
          <button
            type="button"
            className="nf-icon-btn"
            onClick={() => setDark((v) => !v)}
            aria-label={dark ? "Light mode" : "Dark mode"}
          >
            {dark ? NavIcons.sun : NavIcons.moon}
          </button>
          <div className="nf-profile-menu" role="group" aria-label="Signed in user">
            <span className="cc-user-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
              {String(role).slice(0, 2).toUpperCase()}
            </span>
            <span className="nf-profile-label">{role}</span>
          </div>
        </div>
      </header>
      <main className="cc-app-main">{children}</main>
    </>
  );
};
