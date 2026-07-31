import { normalizePathKey } from "./format";
import type { ApplicationGroup, NetworkRequest } from "./types";

export function buildApplicationGroups(
  requests: NetworkRequest[],
  blockedOverrides: Record<string, boolean>,
): ApplicationGroup[] {
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
}
