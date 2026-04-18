import { NavLink, useNavigate } from "react-router-dom";

const sideLinks = [
  { to: "/overview", label: "Overview", icon: "O" },
  { to: "/department-analytics", label: "Data analysis", icon: "DA" },
  { to: "/live-queue", label: "Live Queue", icon: "LQ" },
  { to: "/completed-queue", label: "Completed", icon: "CP" },
  { to: "/create-token", label: "Create Token", icon: "CT" },
  { to: "/patient-records", label: "Patient Records", icon: "PR" },
  { to: "/staff-directory", label: "Staff Directory", icon: "SD" },
  { to: "/reports", label: "Reports", icon: "R" }
];

export const Navbar = () => {
  const navigate = useNavigate();
  const role = localStorage.getItem("auth_role") ?? "nurse";

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_role");
    navigate("/login");
  };

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-left">
          <span className="brand-title">Clinical Curator</span>
        </div>
        <div className="top-nav-right">
          <input className="header-search" placeholder="Search Patients..." />
          <span className="role-badge">{role}</span>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <aside className="side-nav">
        <div className="hospital-block">
          <div className="hospital-icon">+</div>
          <div>
            <h4>Central Hospital</h4>
            <p>Patient Queue Ops</p>
          </div>
        </div>
        <div className="side-links">
          {sideLinks.map((link) => (
            <NavLink
              key={`side-${link.to}`}
              to={link.to}
              className={({ isActive }) =>
                `side-link-item ${isActive ? "active" : ""}`.trim()
              }
            >
              <span className="menu-icon">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
          {role === "admin" ? (
            <NavLink
              to="/settings/departments"
              className={({ isActive }) =>
                `side-link-item ${isActive ? "active" : ""}`.trim()
              }
            >
              <span className="menu-icon">Cfg</span>
              <span>Departments</span>
            </NavLink>
          ) : null}
        </div>
        <div className="side-footer">
          <button type="button" onClick={() => navigate("/token-create")}>
            New Admission
          </button>
          <NavLink className="help-link" to="/help-center">
            <span className="menu-icon">?</span>
            <span>Help Center</span>
          </NavLink>
        </div>
      </aside>
    </>
  );
};
