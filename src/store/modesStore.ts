import { create } from "zustand";
import {
  createMode,
  deleteMode,
  listKnownApps,
  listModes,
  pickExecutablePath,
  pickIconDataUrl,
  relaunchAsAdmin,
  setModeActive,
  updateMode,
  type ModeInput,
} from "@/utils/api";
import type { KnownApp, Mode } from "@/utils/types";

type ModesStore = {
  modes: Mode[];
  knownApps: KnownApp[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  createMode: (input: ModeInput) => Promise<Mode | null>;
  updateMode: (id: string, input: ModeInput) => Promise<Mode | null>;
  deleteMode: (id: string) => Promise<void>;
  setActive: (id: string, active: boolean) => Promise<void>;
  pickIcon: () => Promise<string | null>;
  pickExecutable: () => Promise<string | null>;
};

const ADMIN_REQUIRED_PREFIX = "ADMIN_REQUIRED:";

function isAdminRequiredError(value: unknown): boolean {
  const text = value instanceof Error ? value.message : String(value);
  return text.startsWith(ADMIN_REQUIRED_PREFIX);
}

export const useModesStore = create<ModesStore>((set, get) => ({
  modes: [],
  knownApps: [],
  loading: true,
  error: "",

  async refresh() {
    try {
      const [modes, knownApps] = await Promise.all([listModes(), listKnownApps()]);
      set({ modes, knownApps, loading: false, error: "" });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  async createMode(input) {
    try {
      const mode = await createMode(input);
      await get().refresh();
      return mode;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },

  async updateMode(id, input) {
    try {
      const mode = await updateMode(id, input);
      await get().refresh();
      return mode;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },

  async deleteMode(id) {
    try {
      await deleteMode(id);
      await get().refresh();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  async setActive(id, active) {
    try {
      await setModeActive(id, active);
      await get().refresh();
    } catch (e) {
      if (isAdminRequiredError(e)) {
        const confirmed = window.confirm(
          "Administrator access is required to change active mode. Relaunch the app as Administrator now?",
        );
        if (confirmed) {
          try {
            await relaunchAsAdmin();
          } catch (relaunchError) {
            set({
              error:
                relaunchError instanceof Error
                  ? relaunchError.message
                  : String(relaunchError),
            });
          }
          return;
        }

        set({
          error:
            "Administrator privileges are required. Relaunch as Administrator to continue.",
        });
        return;
      }

      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  async pickIcon() {
    try {
      return await pickIconDataUrl();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },

  async pickExecutable() {
    try {
      return await pickExecutablePath();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },
}));
