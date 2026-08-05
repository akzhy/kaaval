import { Link } from "@tanstack/react-router";
import { css } from "@flairjs/client";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Card from "@/components/Card";
import DataTable from "@/components/DataTable";
import { listRecordings } from "@/utils/api";
import type { RecordingSummary } from "@/utils/types";

function formatDateTime(ms: number) {
  return new Date(ms).toLocaleString();
}

function RecordingsPage() {
  const [rows, setRows] = useState<RecordingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecordings() {
    setLoading(true);
    setError("");
    try {
      const data = await listRecordings();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecordings();
  }, []);

  const columns: ColumnDef<RecordingSummary, any>[] = useMemo(
    () => [
      {
        header: "Name",
        accessorKey: "name",
      },
      {
        header: "Started",
        id: "started",
        cell: ({ row }) => formatDateTime(row.original.started_at_ms),
      },
      {
        header: "Stopped",
        id: "stopped",
        cell: ({ row }) => formatDateTime(row.original.stopped_at_ms),
      },
      {
        header: "Events",
        accessorKey: "event_count",
      },
      {
        header: "Action",
        id: "action",
        cell: ({ row }) => (
          <Link
            className="open-btn"
            to="/activity-log/recordings/$recordingId"
            params={{ recordingId: row.original.id }}
          >
            Open
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <div className="recordings-page">
      <Card>
        <div className="recordings-toolbar">
          <div>
            <p className="recordings-title">Recordings</p>
            <p className="recordings-subtitle">
              Saved network captures from Activity Log recording sessions.
            </p>
          </div>
          <div className="recordings-actions">
            <button type="button" className="refresh-btn" onClick={loadRecordings}>
              Refresh
            </button>
            <Link to="/activity-log" className="back-link">
              Back to Activity Log
            </Link>
          </div>
        </div>

        {error ? <p className="recordings-error">{error}</p> : null}

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          emptyMessage={loading ? "Loading recordings…" : "No recordings yet."}
        />
      </Card>
    </div>
  );
}

RecordingsPage.flair = css`
  .recordings-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .recordings-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
  }

  .recordings-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: $colors.text;
  }

  .recordings-subtitle {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: $colors.text-muted;
  }

  .recordings-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .refresh-btn {
    border: none;
    border-radius: $radii.card;
    background: color-mix(in srgb, $colors.primary, black 8%);
    color: white;
    padding: 8px 12px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }

  .back-link {
    color: $colors.primary;
    text-decoration: none;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .open-btn {
    color: $colors.primary;
    text-decoration: none;
    font-weight: 600;
  }

  .recordings-error {
    margin: 0 0 10px;
    color: $colors.negative;
    font-size: 0.82rem;
  }
`;

export default RecordingsPage;
