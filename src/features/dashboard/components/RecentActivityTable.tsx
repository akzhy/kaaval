import { Link } from "@tanstack/react-router";
import { c, css } from "@flairjs/client";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import type { ApplicationGroup } from "@/utils/types";

type RecentActivityTableProps = {
  groups: ApplicationGroup[];
  limit?: number;
};

function RecentActivityTable({ groups, limit = 5 }: RecentActivityTableProps) {
  const columns: ColumnDef<ApplicationGroup, any>[] = [
    {
      header: "Process Name",
      accessorKey: "appName",
      cell: (info) => (
        <span className={c("process-name")}>{info.getValue<string>()}</span>
      ),
    },
    {
      header: "Remote Address",
      id: "endpoint",
      cell: ({ row }) => row.original.endpoints[0] ?? "—",
    },
    {
      header: "Requests",
      accessorKey: "requestCount",
    },
    {
      header: "Status",
      id: "status",
      cell: ({ row }) => (
        <StatusBadge
          positive={!row.original.blocked}
          positiveLabel="Allowed"
          negativeLabel="Blocked"
        />
      ),
    },
  ];

  return (
    <section className="recent-activity">
      <div className="recent-activity-head">
        <div>
          <p className="recent-activity-title">Recent Activity</p>
          <p className="recent-activity-subtitle">
            Live feed of intercepted network requests
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={groups.slice(0, limit)}
        getRowId={(g) => g.appPath}
      />

      <Link to="/activity-log" className="recent-activity-more">
        Show More Activity
      </Link>
    </section>
  );
}

RecentActivityTable.flair = css`
  .recent-activity {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .recent-activity-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: $colors.text;
  }

  .recent-activity-subtitle {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: $colors.text-muted;
  }

  .recent-activity-more {
    align-self: center;
    color: $colors.primary;
    font-size: 0.85rem;
    text-decoration: none;
  }

  .process-name {
    color: $colors.text;
    font-weight: 500;
  }
`;

export default RecentActivityTable;
