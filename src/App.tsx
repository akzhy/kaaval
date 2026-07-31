import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type NetworkRequest = {
  app_path: string;
  app_name: string;
  pid: number;
  protocol: string;
  local_address: string;
  local_port: number;
  remote_address: string | null;
  remote_port: number | null;
  state: string | null;
  blocked: boolean;
};

type ApplicationGroup = {
  appPath: string;
  appName: string;
  blocked: boolean;
  requestCount: number;
  pids: number[];
  protocols: string[];
  endpoints: string[];
  rows: NetworkRequest[];
};

function normalizePathKey(path: string): string {
  const trimmed = path.trim();
  const withoutPrefix = trimmed.startsWith("\\\\?\\") ? trimmed.slice(4) : trimmed;
  return withoutPrefix.replace(/\//g, "\\").toLowerCase();
}

function App() {
  const [requests, setRequests] = useState<NetworkRequest[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [busyPath, setBusyPath] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [blockedOverrides, setBlockedOverrides] = useState<Record<string, boolean>>({});

  async function refreshRequests() {
    try {
      const next = await invoke<NetworkRequest[]>("list_network_requests");
      setRequests(next);
      setBlockedOverrides((previous) => {
        const merged = { ...previous };
        const backendByPath = new Map<string, boolean>();

        for (const row of next) {
          const key = normalizePathKey(row.app_path);
          const current = backendByPath.get(key) ?? false;
          backendByPath.set(key, current || row.blocked);
        }

        for (const [path, optimistic] of Object.entries(previous)) {
          const backendValue = backendByPath.get(path);
          if (backendValue === optimistic) {
            delete merged[path];
          }
        }

        return merged;
      });
      setError("");
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshRequests();
    const timer = window.setInterval(() => {
      void refreshRequests();
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  async function toggleBlock(group: ApplicationGroup) {
    if (group.appPath.startsWith("<pid:")) {
      setError("Cannot block this process because its executable path is unavailable.");
      return;
    }

    setBusyPath(group.appPath);
    setError("");
    const nextBlocked = !group.blocked;
    const pathKey = normalizePathKey(group.appPath);
    setBlockedOverrides((previous) => ({
      ...previous,
      [pathKey]: nextBlocked,
    }));

    try {
      if (group.blocked) {
        await invoke("unblock_application", { path: group.appPath });
      } else {
        await invoke("block_application", { path: group.appPath });
      }
      await refreshRequests();
    } catch (e) {
      setBlockedOverrides((previous) => {
        const copy = { ...previous };
        copy[pathKey] = group.blocked;
        return copy;
      });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPath("");
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, ApplicationGroup>();
    for (const row of requests) {
      const pathKey = normalizePathKey(row.app_path);
      const key = row.app_path;
      const endpoint = row.remote_address
        ? `${row.remote_address}:${row.remote_port ?? "-"}`
        : `${row.local_address}:${row.local_port}`;
      const entry = map.get(key);
      if (!entry) {
        const effectiveBlocked = blockedOverrides[pathKey] ?? row.blocked;
        map.set(key, {
          appPath: row.app_path,
          appName: row.app_name,
          blocked: effectiveBlocked,
          requestCount: 1,
          pids: [row.pid],
          protocols: [row.protocol],
          endpoints: [endpoint],
          rows: [row],
        });
        continue;
      }

      entry.blocked = blockedOverrides[pathKey] ?? row.blocked;
      entry.requestCount += 1;
      if (!entry.pids.includes(row.pid)) {
        entry.pids.push(row.pid);
      }
      if (!entry.protocols.includes(row.protocol)) {
        entry.protocols.push(row.protocol);
      }
      if (entry.endpoints.length < 4 && !entry.endpoints.includes(endpoint)) {
        entry.endpoints.push(endpoint);
      }
      if (entry.rows.length < 8) {
        entry.rows.push(row);
      }
    }

    return [...map.values()].sort((a, b) => b.requestCount - a.requestCount);
  }, [requests, blockedOverrides]);

  return (
    <main className="dashboard">
      <header className="hero">
        <p className="kicker">Realtime</p>
        <h1>Network Activity Control Center</h1>
        <p className="subtitle">
          Live process-level traffic from Windows IP Helper with one-click block or allow using WFP rules.
        </p>
        <div className="meta">
          <span>{loading ? "Loading..." : `${requests.length} active flows`}</span>
          <span>{lastUpdated ? `Updated ${lastUpdated}` : "Waiting for first snapshot"}</span>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="apps-grid">
        {groups.map((group) => {
          const inFlight = busyPath === group.appPath;
          return (
            <article className="app-card" key={group.appPath}>
              <div className="app-top">
                <div>
                  <h2>{group.appName}</h2>
                  <p className="path">{group.appPath}</p>
                </div>
                <span className={group.blocked ? "badge blocked" : "badge allowed"}>
                  {group.blocked ? "Blocked" : "Allowed"}
                </span>
              </div>

              <div className="stats">
                <div>
                  <strong>{group.requestCount}</strong>
                  <span>Requests</span>
                </div>
                <div>
                  <strong>{group.pids.join(", ")}</strong>
                  <span>PIDs</span>
                </div>
                <div>
                  <strong>{group.protocols.join(" / ")}</strong>
                  <span>Protocols</span>
                </div>
              </div>

              <ul className="endpoints">
                {group.endpoints.map((endpoint) => (
                  <li key={endpoint}>{endpoint}</li>
                ))}
              </ul>

              <button
                className={group.blocked ? "toggle allow" : "toggle block"}
                disabled={inFlight || group.appPath.startsWith("<pid:")}
                onClick={() => void toggleBlock(group)}
              >
                {inFlight ? "Applying..." : group.blocked ? "Unblock" : "Block"}
              </button>
            </article>
          );
        })}
      </section>

      {!loading && groups.length === 0 ? (
        <div className="empty">No active TCP/UDP process traffic detected right now.</div>
      ) : null}
    </main>
  );
}

export default App;
