import { Link, useRouterState } from "@tanstack/react-router";
import { css } from "@flairjs/client";
import { useState } from "react";
import clsx from "clsx";
import logo from "@/assets/logo_64x64.png";
import {
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Logs,
  Settings,
  SlidersHorizontal,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", Icon: ChartNoAxesCombined },
  { to: "/modes", label: "Modes", Icon: SlidersHorizontal },
  { to: "/activity-log", label: "Activity Log", Icon: Logs },
  { to: "/settings", label: "Settings", Icon: Settings },
] as const;

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const currentPath = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <aside className={clsx("sidebar", { "sidebar-collapsed": isCollapsed })}>
      <div className="brand">
        <img src={logo} alt="Kaaval logo" className="brand-logo" />
        {!isCollapsed && <p className="brand-name">Kaaval</p>}
      </div>

      <nav className="nav">
        {NAV_ITEMS.map(({ to, label, Icon }) => {
          const isActive =
            to === "/"
              ? currentPath === "/"
              : currentPath === to || currentPath.startsWith(`${to}/`);

          return (
            <Link
              key={to}
              to={to}
              className={clsx("nav-link", {
                "nav-link-active": isActive,
                "nav-link-collapsed": isCollapsed,
              })}
              title={label}
            >
              <Icon className="nav-icon" size={18} />
              {!isCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        className={clsx("collapse-btn", {
          "collapse-btn-collapsed": isCollapsed,
        })}
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
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
    transition:
      width 0.2s ease,
      padding 0.2s ease;
    position: relative;
  }

  .sidebar-collapsed {
    width: 72px;
    padding: 20px 10px;

    .brand {
      justify-content: center;
    }
  }

  .brand {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 8px;
    position: relative;
  }

  .brand-name {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: $colors.primary;
  }

  .brand-logo {
    width: 20px;
    height: 20px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .collapse-btn {
    width: 28px;
    height: 28px;
    position: absolute;
    right: 0px;
    bottom: 10px;
    border: none;
    border-radius: $radii.card;
    background: transparent;
    color: $colors.text-muted;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      color 0.2s ease,
      transform 0.2s ease;
  }

  .collapse-btn:hover {
    background-color: $colors.surface-bright;
    color: $colors.text;
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

  .nav-link-collapsed {
    justify-content: center;
    padding: 10px 8px;
  }

  .nav-link:hover {
    background-color: $colors.surface-bright;
    color: $colors.text;
  }

  .nav-link-active {
    background-color: $colors.primary;
    color: white;
  }

  .nav-link-active:hover {
    background-color: color-mix(in srgb, $colors.primary, black 20%);
    color: white;
  }

  .nav-icon {
    flex-shrink: 0;
  }
`;

export default Sidebar;
