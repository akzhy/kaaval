import { Link, useRouterState } from "@tanstack/react-router";
import { css } from "@flairjs/client";
import { useState } from "react";
import clsx from "clsx";
import logo from "@/assets/logo_64x64.png";
import {
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
  Logs,
  Settings,
  SlidersHorizontal,
  CirclePileIcon,
  CassetteTapeIcon,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  Icon: LucideIcon;
  children?: readonly {
    to: string;
    label: string;
    Icon?: LucideIcon;
  }[];
};

const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: "Dashboard", Icon: ChartNoAxesCombined },
  {
    to: "/modes",
    label: "Modes",
    Icon: SlidersHorizontal,
    children: [
      {
        to: "/modes/community",
        label: "Community Modes",
        Icon: CirclePileIcon,
      },
    ],
  },
  {
    to: "/activity-log",
    label: "Activity Log",
    Icon: Logs,
    children: [
      {
        to: "/activity-log/recordings",
        label: "Recordings",
        Icon: CassetteTapeIcon,
      },
    ],
  },
  { to: "/settings", label: "Settings", Icon: Settings },
];

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
        {NAV_ITEMS.map(({ to, label, Icon, children }) => {
          const isActive =
            to === "/"
              ? currentPath === "/"
              : currentPath === to || currentPath.startsWith(`${to}/`);
          const hasActiveChild =
            !!children &&
            children.some(
              (child) =>
                currentPath === child.to || currentPath.startsWith(`${child.to}/`),
            );
          const showChildren = !isCollapsed && isActive && children?.length;

          return (
            <div key={to} className="nav-item">
              <Link
                to={to}
                className={clsx("nav-link", {
                  "nav-link-active": isActive,
                  "nav-link-active-parent": hasActiveChild,
                  "nav-link-collapsed": isCollapsed,
                })}
                title={label}
              >
                <Icon className="nav-icon" size={18} />
                {!isCollapsed && <span>{label}</span>}
              </Link>

              {showChildren ? (
                <div className="nav-children">
                  {children.map((child) => {
                    const isChildActive =
                      currentPath === child.to ||
                      currentPath.startsWith(`${child.to}/`);

                    return (
                      <Link
                        key={child.to}
                        to={child.to}
                        className={clsx("nav-sublink", {
                          "nav-sublink-active": isChildActive,
                        })}
                        title={child.label}
                      >
                        {child.Icon && <child.Icon className="nav-icon" size={14} />}
                        <span>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
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

  .nav-item {
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

  .nav-link-active-parent {
    background-color: transparent;
    color: $colors.primary;
  }

  .nav-link-active-parent:hover {
    background-color: color-mix(in srgb, $colors.primary, white 90%);
    color: $colors.primary;
  }

  .nav-link-active:hover {
    background-color: color-mix(in srgb, $colors.primary, black 20%);
    color: white;
  }

  .nav-icon {
    flex-shrink: 0;
  }

  .nav-children {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-left: 12px;
  }

  .nav-sublink {
    display: flex;
    align-items: center;
    min-height: 32px;
    padding: 6px 12px;
    border-radius: $radii.card;
    color: $colors.text-muted;
    text-decoration: none;
    font-size: 0.82rem;
    font-weight: 500;
    gap: 8px;
  }

  .nav-sublink:hover {
    background-color: $colors.surface-bright;
    color: $colors.text;
  }

  .nav-sublink-active {
    background-color: $colors.primary;
    color: white;
  }

  .nav-sublink-active:hover {
    background-color: color-mix(in srgb, $colors.primary, black 20%);
    color: white;
  }
`;

export default Sidebar;
