import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { css } from "@flairjs/client";
import type { ColumnDef } from "@tanstack/react-table";
import Card from "@/components/Card";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { useNetworkPolling } from "@/features/network/useNetworkPolling";
import { useNetworkStore } from "@/store/networkStore";
import { buildApplicationGroups } from "@/utils/groupRequests";
import type { ApplicationGroup } from "@/utils/types";

function ActivityLogPage() {
  const requests = useNetworkStore((state) => state.requests);
  const blockedOverrides = useNetworkStore((state) => state.blockedOverrides);
  const busyPath = useNetworkStore((state) => state.busyPath);
  const toggleBlock = useNetworkStore((state) => state.toggleBlock);
  const lastUpdated = useNetworkStore((state) => state.lastUpdated);
  const recordingStatus = useNetworkStore((state) => state.recordingStatus);
  const recordingBusy = useNetworkStore((state) => state.recordingBusy);
  const startRecording = useNetworkStore((state) => state.startRecording);
  const stopRecording = useNetworkStore((state) => state.stopRecording);
  const [search, setSearch] = useState("");

  useNetworkPolling();

  function suggestedRecordingName(startedAtMs: number | null) {
    const date = new Date(startedAtMs ?? Date.now());
    const pad = (n: number) => String(n).padStart(2, "0");
    return `recording-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  async function onRecordClick() {
    if (!recordingStatus.is_recording) {
      await startRecording();
      return;
    }

    const fallbackName = suggestedRecordingName(recordingStatus.started_at_ms);
    const entered = window.prompt("Recording name", fallbackName);
    if (entered === null) {
      return;
    }

    await stopRecording(entered.trim() || fallbackName);
  }

  const groups = useMemo(
    () => buildApplicationGroups(requests, blockedOverrides),
    [requests, blockedOverrides],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return groups;
    }
    return groups.filter(
      (group) =>
        group.appName.toLowerCase().includes(query) ||
        group.appPath.toLowerCase().includes(query),
    );
  }, [groups, search]);

  const columns: ColumnDef<ApplicationGroup, any>[] = useMemo(
    () => [
      {
        header: "Process Name",
        id: "process",
        cell: ({ row }) => (
          <div>
            <p className="process-name">{row.original.appName}</p>
            <p className="process-path">{row.original.appPath}</p>
          </div>
        ),
      },
      {
        header: "Protocols",
        id: "protocols",
        cell: ({ row }) => row.original.protocols.join(", "),
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
      {
        header: "Action",
        id: "action",
        cell: ({ row }) => {
          const group = row.original;
          const disabled =
            group.appPath.startsWith("<pid:") || busyPath === group.appPath;
          return (
            <button
              type="button"
              className={
                group.blocked
                  ? "action-btn action-btn-allow"
                  : "action-btn action-btn-block"
              }
              disabled={disabled}
              onClick={() => toggleBlock(group)}
            >
              {busyPath === group.appPath
                ? "Working…"
                : group.blocked
                  ? "Allow"
                  : "Block"}
            </button>
          );
        },
      },
    ],
    [busyPath, toggleBlock],
  );

  return (
    <div className="activity-log-page">
      <Card>
        <div className="activity-log-toolbar">
          <div>
            <p className="activity-log-title">Activity Log</p>
            <p className="activity-log-subtitle">
              {lastUpdated
                ? `Last updated ${new Date(lastUpdated).toLocaleTimeString()}`
                : "Waiting for first snapshot"}
            </p>
          </div>
          <div className="activity-log-actions">
            <input
              className="activity-log-search"
              placeholder="Search processes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className={
                recordingStatus.is_recording
                  ? "record-btn record-btn-stop"
                  : "record-btn record-btn-start"
              }
              onClick={onRecordClick}
              disabled={recordingBusy}
            >
              {recordingBusy
                ? "Working…"
                : recordingStatus.is_recording
                  ? `Record (On: ${recordingStatus.event_count})`
                  : "Record"}
            </button>
            <Link to="/activity-log/recordings" className="recordings-link">
              View Recordings
            </Link>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          getRowId={(g) => g.appPath}
          emptyMessage="No matching processes."
        />
      </Card>
    </div>
  );
}

ActivityLogPage.flair = css`
  .activity-log-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .activity-log-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
  }

  .activity-log-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .activity-log-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: $colors.text;
  }

  .activity-log-subtitle {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: $colors.text-muted;
  }

  .activity-log-search {
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 8px 12px;
    color: $colors.text;
    font-size: 0.85rem;
    min-width: 220px;
  }

  .activity-log-search:focus {
    outline: 1px solid $colors.primary;
  }

  .record-btn {
    border: none;
    border-radius: $radii.card;
    padding: 8px 12px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    color: white;
  }

  .record-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .record-btn-start {
    background: color-mix(in srgb, $colors.primary, black 8%);
  }

  .record-btn-stop {
    background: $colors.negative;
  }

  .recordings-link {
    color: $colors.primary;
    text-decoration: none;
    font-size: 0.8rem;
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

  .action-btn {
    border: none;
    border-radius: $radii.card;
    padding: 6px 12px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    color: white;
  }

  .action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-btn-block {
    background-color: $colors.negative;
  }

  .action-btn-allow {
    background-color: $colors.positive;
    color: #0a1f06;
  }
`;

export default ActivityLogPage;
