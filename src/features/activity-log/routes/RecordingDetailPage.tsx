import { Link, useParams } from "@tanstack/react-router";
import { css } from "@flairjs/client";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Card from "@/components/Card";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { getRecording } from "@/utils/api";
import type { RecordedNetworkEvent, RecordingFile } from "@/utils/types";

function formatDateTime(ms: number) {
  return new Date(ms).toLocaleString();
}

function endpoint(row: RecordedNetworkEvent) {
  if (row.remote_address) {
    return `${row.remote_address}:${row.remote_port ?? "-"}`;
  }
  return `${row.local_address}:${row.local_port}`;
}

function RecordingDetailPage() {
  const { recordingId } = useParams({
    from: "/activity-log/recordings/$recordingId",
  });

  const [recording, setRecording] = useState<RecordingFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getRecording(recordingId);
        if (active) {
          setRecording(data);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : String(e));
          setRecording(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [recordingId]);

  const filteredEvents = useMemo(() => {
    if (!recording) {
      return [];
    }

    const query = search.trim().toLowerCase();
    if (!query) {
      return recording.events;
    }

    return recording.events.filter((event) => {
      return (
        event.app_name.toLowerCase().includes(query) ||
        event.app_path.toLowerCase().includes(query) ||
        (event.remote_address ?? "").toLowerCase().includes(query) ||
        event.local_address.toLowerCase().includes(query) ||
        event.protocol.toLowerCase().includes(query)
      );
    });
  }, [recording, search]);

  const columns: ColumnDef<RecordedNetworkEvent, any>[] = useMemo(
    () => [
      {
        header: "Time",
        id: "time",
        cell: ({ row }) => formatDateTime(row.original.captured_at_ms),
      },
      {
        header: "Process Name",
        id: "process",
        cell: ({ row }) => (
          <div>
            <p className="process-name">{row.original.app_name}</p>
            <p className="process-path">{row.original.app_path}</p>
          </div>
        ),
      },
      {
        header: "Protocol",
        accessorKey: "protocol",
      },
      {
        header: "Remote Address",
        id: "remote",
        cell: ({ row }) => endpoint(row.original),
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
    ],
    [],
  );

  return (
    <div className="recording-detail-page">
      <Card>
        <div className="detail-toolbar">
          <div>
            <p className="detail-title">{recording?.name ?? "Recording"}</p>
            <p className="detail-subtitle">
              {recording
                ? `${formatDateTime(recording.started_at_ms)} to ${formatDateTime(recording.stopped_at_ms)} | ${recording.events.length} events`
                : "Loading recording"}
            </p>
          </div>
          <div className="detail-actions">
            <input
              className="detail-search"
              placeholder="Search app, host/IP, or protocol…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Link to="/activity-log/recordings" className="back-link">
              Back to Recordings
            </Link>
          </div>
        </div>

        {error ? <p className="detail-error">{error}</p> : null}

        <DataTable
          columns={columns}
          data={filteredEvents}
          getRowId={(row, index) => `${row.captured_at_ms}-${row.pid}-${index}`}
          emptyMessage={
            loading
              ? "Loading recording…"
              : "No matching events in this recording."
          }
        />
      </Card>
    </div>
  );
}

RecordingDetailPage.flair = css`
  .recording-detail-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .detail-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
  }

  .detail-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: $colors.text;
  }

  .detail-subtitle {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: $colors.text-muted;
  }

  .detail-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .detail-search {
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 8px 12px;
    color: $colors.text;
    font-size: 0.85rem;
    min-width: 240px;
  }

  .detail-search:focus {
    outline: 1px solid $colors.primary;
  }

  .back-link {
    color: $colors.primary;
    text-decoration: none;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .process-name {
    margin: 0;
    color: $colors.text;
    font-weight: 500;
  }

  .process-path {
    margin: 2px 0 0;
    color: $colors.text-muted;
    font-size: 0.72rem;
    word-break: break-all;
  }

  .detail-error {
    margin: 0 0 10px;
    color: $colors.negative;
    font-size: 0.82rem;
  }
`;

export default RecordingDetailPage;
