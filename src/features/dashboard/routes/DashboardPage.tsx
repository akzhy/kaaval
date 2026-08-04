import Card from "@/components/Card";
import ModesPreview from "@/features/dashboard/components/ModesPreview";
import RecentActivityTable from "@/features/dashboard/components/RecentActivityTable";
import ThroughputChart from "@/features/dashboard/components/ThroughputChart";
import { relaunchAsAdmin } from "@/utils/api";
import { useNetworkStore } from "@/store/networkStore";
import { buildApplicationGroups } from "@/utils/groupRequests";
import { css } from "@flairjs/client";
import { useState } from "react";

function DashboardPage() {
  const [relaunching, setRelaunching] = useState(false);
  const requests = useNetworkStore((state) => state.requests);
  const blockedOverrides = useNetworkStore((state) => state.blockedOverrides);
  const dashboardStats = useNetworkStore((state) => state.dashboardStats);
  const throughputHistory = useNetworkStore((state) => state.throughputHistory);
  const error = useNetworkStore((state) => state.error);
  const isAdmin = useNetworkStore((state) => state.isAdmin);

  async function onRelaunchAsAdmin() {
    setRelaunching(true);
    try {
      await relaunchAsAdmin();
    } catch (e) {
      console.error("failed to relaunch as administrator", e);
      setRelaunching(false);
    }
  }

  const groups = buildApplicationGroups(requests, blockedOverrides);

  return (
    <div className="dashboard-page">
      {!isAdmin ? (
        <div className="dashboard-error dashboard-admin-warning">
          <div>
            Administrator mode is required for blocking apps and toggling modes.
          </div>
          <button
            type="button"
            className="dashboard-relaunch-btn"
            onClick={() => onRelaunchAsAdmin()}
            disabled={relaunching}
          >
            {relaunching ? "Relaunching..." : "Relaunch as Administrator"}
          </button>
        </div>
      ) : null}

      {error ? <div className="dashboard-error">{error}</div> : null}

      <div className="dashboard-grid">
        <Card className="dashboard-throughput">
          <ThroughputChart
            history={throughputHistory}
            current={dashboardStats.throughput_mbps}
          />
        </Card>
      </div>

      <Card>
        <ModesPreview />
      </Card>

      <Card>
        <RecentActivityTable groups={groups} />
      </Card>
    </div>
  );
}

DashboardPage.flair = css`
  .dashboard-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .dashboard-error {
    border: 1px solid $colors.negative;
    background-color: color-mix(in srgb, $colors.negative 12%, transparent);
    color: $colors.negative;
    border-radius: $radii.card;
    padding: 10px 14px;
    font-size: 0.85rem;
  }

  .dashboard-admin-warning {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .dashboard-relaunch-btn {
    border: 1px solid $colors.negative;
    background: color-mix(in srgb, $colors.negative 14%, transparent);
    color: $colors.negative;
    border-radius: $radii.pill;
    padding: 6px 12px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .dashboard-relaunch-btn:disabled {
    opacity: 0.65;
    cursor: default;
  }

  .dashboard-grid {
    display: grid;
  }

  .dashboard-throughput {
    min-height: 180px;
  }
`;

export default DashboardPage;
