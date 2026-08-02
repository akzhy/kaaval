import { Link } from "@tanstack/react-router";
import { c, css } from "@flairjs/client";
import { ActivityLogIcon, DashboardIcon, ModesIcon, SettingsIcon } from "./icons";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", Icon: DashboardIcon },
  { to: "/modes", label: "Modes", Icon: ModesIcon },
  { to: "/activity-log", label: "Activity Log", Icon: ActivityLogIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
] as const;

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <p className="brand-name">Kaaval</p>
        <p className="brand-tag">Enterprise Firewall</p>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="nav-link"
            activeOptions={{ exact: to === "/" }}
            activeProps={{ className: c("nav-link nav-link-active") }}
          >
            <Icon className="nav-icon" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

Sidebar.flair = css`
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    background-color: $colors.surface;
    border-right: 1px solid $colors.border;
    padding: 20px 14px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .brand-name {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: $colors.primary;
  }

  .brand-tag {
    margin: 2px 0 0;
    font-size: 0.72rem;
    color: $colors.text-muted;
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: $radii.card;
    color: $colors.text-muted;
    text-decoration: none;
    font-size: 0.88rem;
    font-weight: 500;
  }

  .nav-link:hover {
    background-color: $colors.surface-bright;
    color: $colors.text;
  }

  .nav-link-active {
    background-color: $colors.primary;
    color: white;
  }

  .nav-icon {
    flex-shrink: 0;
  }
`;

export default Sidebar;
