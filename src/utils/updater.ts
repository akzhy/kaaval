import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";

export type PendingUpdate = {
  version: string;
  currentVersion: string;
  notes: string;
  install: () => Promise<void>;
};

export type UpdateCheckResult =
  | { status: "up-to-date" }
  | { status: "available"; update: PendingUpdate }
  | { status: "failed"; message: string };

export async function getAppVersionString(): Promise<string> {
  return getVersion();
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const update = await check();
    if (!update) {
      return { status: "up-to-date" };
    }

    return {
      status: "available",
      update: {
        version: update.version,
        currentVersion: update.currentVersion,
        notes: (update.body ?? "").trim(),
        install: async () => {
          await update.downloadAndInstall();
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "failed", message };
  }
}

export async function checkForUpdatesSilently(): Promise<void> {
  await check();
}
