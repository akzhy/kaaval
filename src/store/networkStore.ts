import { create } from "zustand";
import {
  blockApplication,
  getAdminStatus,
  getDashboardStats,
  getRecordingStatus,
  listNetworkRequests,
  relaunchAsAdmin,
  startRecording as startRecordingApi,
  stopRecording as stopRecordingApi,
  unblockApplication,
} from "@/utils/api";
import { isAdminRequiredError } from "@/utils/admin";
import { ADMIN_REQUIRED_MESSAGE } from "@/utils/constants";
import { normalizePathKey } from "@/utils/format";
import type {
  ApplicationGroup,
  DashboardStats,
  NetworkRequest,
  RecordingStatus,
  RecordingSummary,
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
  isAdmin: boolean;
  recordingStatus: RecordingStatus;
  recordingBusy: boolean;
  refresh: () => Promise<void>;
  toggleBlock: (group: ApplicationGroup) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: (name?: string) => Promise<RecordingSummary>;
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
  isAdmin: false,
  recordingStatus: {
    is_recording: false,
    started_at_ms: null,
    event_count: 0,
  },
  recordingBusy: false,

  async refresh() {
    try {
      const [requests, dashboardStats, adminStatus, recordingStatus] =
        await Promise.all([
          listNetworkRequests(),
          getDashboardStats(),
          getAdminStatus(),
          getRecordingStatus(),
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
          isAdmin: adminStatus.is_admin,
          recordingStatus,
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
      if (isAdminRequiredError(e)) {
        const confirmed = window.confirm(
          "Administrator access is required to change block state. Relaunch the app as Administrator now?",
        );

        if (confirmed) {
          try {
            await relaunchAsAdmin();
          } catch (relaunchError) {
            set((state) => ({
              blockedOverrides: {
                ...state.blockedOverrides,
                [pathKey]: group.blocked,
              },
              error:
                relaunchError instanceof Error
                  ? relaunchError.message
                  : String(relaunchError),
            }));
          }
          return;
        }

        set((state) => ({
          blockedOverrides: {
            ...state.blockedOverrides,
            [pathKey]: group.blocked,
          },
          error: ADMIN_REQUIRED_MESSAGE,
        }));
        return;
      }

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

  async startRecording() {
    set({ recordingBusy: true, error: "" });
    try {
      const status = await startRecordingApi();
      set({ recordingStatus: status });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ recordingBusy: false });
    }
  },

  async stopRecording(name?: string) {
    set({ recordingBusy: true, error: "" });
    try {
      const summary = await stopRecordingApi(name);
      const status = await getRecordingStatus();
      set({ recordingStatus: status });
      return summary;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ recordingBusy: false });
    }
  },
}));
