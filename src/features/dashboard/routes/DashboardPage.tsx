import Card from "@/components/Card";
import ModesPreview from "@/features/dashboard/components/ModesPreview";
import RecentActivityTable from "@/features/dashboard/components/RecentActivityTable";
import ThroughputChart from "@/features/dashboard/components/ThroughputChart";
import { useNetworkStore } from "@/store/networkStore";
import { buildApplicationGroups } from "@/utils/groupRequests";
import { css } from "@flairjs/client";

function DashboardPage() {
  const requests = useNetworkStore((state) => state.requests);
  const blockedOverrides = useNetworkStore((state) => state.blockedOverrides);
  const dashboardStats = useNetworkStore((state) => state.dashboardStats);
  const throughputHistory = useNetworkStore((state) => state.throughputHistory);
  const error = useNetworkStore((state) => state.error);

  const groups = buildApplicationGroups(requests, blockedOverrides);

  return (
    <div className="dashboard-page">
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

  .dashboard-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 16px;
  }

  .dashboard-throughput {
    min-height: 180px;
  }

  @media (max-width: 900px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export default DashboardPage;
