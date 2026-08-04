import { formatMbps } from "@/utils/format";
import { css } from "@flairjs/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minimize2Icon, Minus, X } from "lucide-react";
import { useEffect, useState } from "react";

const currentWindow = getCurrentWindow();

type TopBarProps = {
  secure: boolean;
  isAdmin: boolean;
  throughputMbps: number;
};

function TopBar({ secure, isAdmin, throughputMbps }: TopBarProps) {
  const statusOk = secure && isAdmin;
  const statusText = isAdmin
    ? secure
      ? "App Status: Running"
      : "App Status: Attention Needed"
    : "App Status: Administrator privileges required for blocking and modes";
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const maximized = await currentWindow.isMaximized();
        if (mounted) {
          setIsMaximized(maximized);
        }
      } catch (error) {
        console.error("failed to read window state", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [currentWindow]);

  async function onMinimize() {
    await currentWindow.minimize();
  }

  async function onToggleMaximize() {
    await currentWindow.toggleMaximize();
    setIsMaximized(await currentWindow.isMaximized());
  }

  async function onClose() {
    await currentWindow.close();
  }

  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="status">
          <span
            className={
              statusOk
                ? "status-dot status-dot-ok"
                : "status-dot status-dot-bad"
            }
          />
          <span className="status-label">{statusText}</span>
        </div>
        <div className="net">
          <span className="net-label">Net</span>
          <span className="net-value">{formatMbps(throughputMbps)}</span>
        </div>
      </div>
      <div className="window-controls">
        <button
          type="button"
          className="window-control"
          onClick={() => onMinimize()}
          aria-label="Minimize window"
          title="Minimize"
        >
          <Minus size={15} />
        </button>
        <button
          type="button"
          className="window-control"
          onClick={() => onToggleMaximize()}
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Minimize2Icon size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          type="button"
          className="window-control window-control-close"
          onClick={() => onClose()}
          aria-label="Close window"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>
    </header>
  );
}

TopBar.flair = css`
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 56px;
    border-bottom: 1px solid $colors.border;
    background-color: $colors.surface;
    -webkit-app-region: drag;
    user-select: none;
  }

  .topbar-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px 14px 24px;
    min-width: 0;
    user-select: none;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot-ok {
    background-color: $colors.positive;
  }

  .status-dot-bad {
    background-color: $colors.negative;
  }

  .status-label {
    font-size: 0.85rem;
    color: $colors.text;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .net {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: $colors.text-muted;
  }

  .net-value {
    color: $colors.text;
    font-weight: 600;
  }

  .window-controls {
    display: flex;
    align-self: stretch;
    -webkit-app-region: no-drag;
  }

  .window-control {
    width: 46px;
    border: none;
    background: transparent;
    color: $colors.text-muted;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .window-control:hover {
    background-color: $colors.surface-bright;
    color: $colors.text;
  }

  .window-control-close:hover {
    background-color: $colors.negative;
    color: white;
  }
`;

export default TopBar;
