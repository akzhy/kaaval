import { css } from "@flairjs/client";
import { formatMbps } from "@/utils/format";

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

  return (
    <header className="topbar">
      <div className="status">
        <span
          className={
            statusOk ? "status-dot status-dot-ok" : "status-dot status-dot-bad"
          }
        />
        <span className="status-label">{statusText}</span>
      </div>
      <div className="net">
        <span className="net-label">Net</span>
        <span className="net-value">{formatMbps(throughputMbps)}</span>
      </div>
    </header>
  );
}

TopBar.flair = css`
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 24px;
    border-bottom: 1px solid $colors.border;
    background-color: $colors.surface;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
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
`;

export default TopBar;
