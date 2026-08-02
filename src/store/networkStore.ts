import { create } from "zustand";
import {
  blockApplication,
  getDashboardStats,
  listNetworkRequests,
  unblockApplication,
} from "@/utils/api";
import { normalizePathKey } from "@/utils/format";
import type {
  ApplicationGroup,
  DashboardStats,
  NetworkRequest,
} from "@/utils/types";

const THROUGHPUT_HISTORY_LENGTH = 100;

type NetworkStore = {
  requests: NetworkRequest[];
  blockedOverrides: Record<string, boolean>;
  dashboardStats: DashboardStats;
  throughputHistory: number[];
  loading: boolean;
  error: string;
  lastUpdated: string;
  busyPath: string;
  refresh: () => Promise<void>;
  toggleBlock: (group: ApplicationGroup) => Promise<void>;
};

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  requests: [],
  blockedOverrides: {},
  dashboardStats: { throughput_mbps: 0, active_sessions: 0, blocked_today: 0 },
  throughputHistory: [],
  loading: true,
  error: "",
  lastUpdated: "",
  busyPath: "",

  async refresh() {
    try {
      const [requests, dashboardStats] = await Promise.all([
        listNetworkRequests(),
        getDashboardStats(),
      ]);

      set((state) => {
        const merged = { ...state.blockedOverrides };
        const backendByPath = new Map<string, boolean>();

        for (const row of requests) {
          const key = normalizePathKey(row.app_path);
          const current = backendByPath.get(key) ?? false;
          backendByPath.set(key, current || row.blocked);
        }

        for (const [path, optimistic] of Object.entries(
          state.blockedOverrides,
        )) {
          if (backendByPath.get(path) === optimistic) {
            delete merged[path];
          }
        }

        const history = [
          ...state.throughputHistory,
          dashboardStats.throughput_mbps,
        ].slice(-THROUGHPUT_HISTORY_LENGTH);

        return {
          requests,
          dashboardStats,
          throughputHistory: history,
          blockedOverrides: merged,
          error: "",
          loading: false,
          lastUpdated: new Date().toISOString(),
        };
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        loading: false,
      });
    }
  },

  async toggleBlock(group: ApplicationGroup) {
    if (group.appPath.startsWith("<pid:")) {
      set({
        error:
          "Cannot block this process because its executable path is unavailable.",
      });
      return;
    }

    const pathKey = normalizePathKey(group.appPath);
    const nextBlocked = !group.blocked;
    set((state) => ({
      busyPath: group.appPath,
      error: "",
      blockedOverrides: { ...state.blockedOverrides, [pathKey]: nextBlocked },
    }));

    try {
      if (group.blocked) {
        await unblockApplication(group.appPath);
      } else {
        await blockApplication(group.appPath);
      }
      await get().refresh();
    } catch (e) {
      set((state) => ({
        blockedOverrides: {
          ...state.blockedOverrides,
          [pathKey]: group.blocked,
        },
        error: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      set({ busyPath: "" });
    }
  },
}));
