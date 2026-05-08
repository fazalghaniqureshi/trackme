import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { isTraccarConfigured } from "../services/traccarService";
import { canManageUsers, isAdmin } from "../services/userService";

// ── Inline SVG icon helper ────────────────────────────────────────────────────
const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const Icons = {
  map: (
    <Icon>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </Icon>
  ),
  dashboard: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Icon>
  ),
  devices: (
    <Icon>
      <rect x="2" y="3" width="20" height="4" rx="1" />
      <rect x="2" y="10" width="20" height="4" rx="1" />
      <rect x="2" y="17" width="20" height="4" rx="1" />
      <circle cx="18" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="19" r="1" fill="currentColor" stroke="none" />
    </Icon>
  ),
  drivers: (
    <Icon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
  geofences: (
    <Icon>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </Icon>
  ),
  maintenance: (
    <Icon>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Icon>
  ),
  fuel: (
    <Icon>
      <path d="M3 22V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15" />
      <path d="M2 22h14" />
      <path d="M15 7h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9a7 7 0 0 0-7-7H15" />
      <line x1="6" y1="11" x2="12" y2="11" />
      <line x1="9" y1="8" x2="9" y2="14" />
    </Icon>
  ),
  expenses: (
    <Icon>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </Icon>
  ),
  reports: (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </Icon>
  ),
  alerts: (
    <Icon>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Icon>
  ),
  plug: (
    <Icon>
      <path d="M12 22V12" />
      <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
      <rect x="7" y="2" width="3" height="6" rx="1" />
      <rect x="14" y="2" width="3" height="6" rx="1" />
    </Icon>
  ),
  menu: (
    <Icon>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </Icon>
  ),
  close: (
    <Icon>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Icon>
  ),
  logo: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
};

// ── Component ─────────────────────────────────────────────────────────────────
const Navigation = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const connected = isTraccarConfigured();

  const navGroups = [
    {
      label: "Live",
      items: [
        { to: "/", label: "Map View", icon: Icons.map },
        { to: "/dashboard", label: "Dashboard", icon: Icons.dashboard },
      ],
    },
    {
      label: "Fleet",
      items: [
        { to: "/admin", label: "Devices", icon: Icons.devices },
        { to: "/drivers", label: "Drivers", icon: Icons.drivers },
        { to: "/geofences", label: "Geofences", icon: Icons.geofences },
        ...(canManageUsers() ? [{ to: "/users", label: "Users", icon: Icons.drivers }] : []),
        ...(isAdmin() ? [{ to: "/groups", label: "Fleets", icon: Icons.dashboard }] : []),
      ],
    },
    {
      label: "Operations",
      items: [
        { to: "/maintenance", label: "Maintenance", icon: Icons.maintenance },
        { to: "/fuel", label: "Fuel Log", icon: Icons.fuel },
        { to: "/expenses", label: "Expenses", icon: Icons.expenses },
        { to: "/reports", label: "Reports", icon: Icons.reports },
      ],
    },
    {
      label: "System",
      items: [
        { to: "/alerts", label: "Alerts", icon: Icons.alerts },
        { to: "/traccar", label: "Traccar", icon: Icons.plug },
      ],
    },
  ];

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const close = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="mobile-nav-toggle"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? Icons.close : Icons.menu}
        <span>Menu</span>
      </button>

      {/* Backdrop */}
      {mobileOpen && <div className="sidebar-overlay open" onClick={close} />}

      {/* Sidebar */}
      <aside className={`app-sidebar${mobileOpen ? " open" : ""}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">{Icons.logo}</div>
          <div className="sidebar-logo-text">
            Track<span>Me</span>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.label} className="nav-group">
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`nav-item-link${isActive(item.to) ? " active" : ""}`}
                  onClick={close}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer status */}
        <div className="sidebar-footer">
          {connected ? (
            <div className="sidebar-status">
              <div className="sidebar-status-dot connected" />
              <span style={{ fontSize: 12, color: "var(--c-muted)" }}>Traccar Connected</span>
            </div>
          ) : (
            <Link to="/traccar" className="sidebar-offline-card" onClick={close}>
              <span className="sidebar-offline-dot" />
              <div>
                <div className="sidebar-offline-title">Traccar Offline</div>
                <div className="sidebar-offline-sub">Tap to connect →</div>
              </div>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
};

export default Navigation;
