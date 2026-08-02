import { invoke } from "@tauri-apps/api/core";
import type { AppMatcher, DashboardStats, KnownApp, Mode, ModeType, NetworkRequest } from "./types";

export function listNetworkRequests(): Promise<NetworkRequest[]> {
  return invoke<NetworkRequest[]>("list_network_requests");
}

export function getDashboardStats(): Promise<DashboardStats> {
  return invoke<DashboardStats>("get_dashboard_stats");
}

export function blockApplication(path: string): Promise<void> {
  return invoke("block_application", { path });
}

export function unblockApplication(path: string): Promise<void> {
  return invoke("unblock_application", { path });
}

export function listModes(): Promise<Mode[]> {
  return invoke<Mode[]>("list_modes");
}

export function listKnownApps(): Promise<KnownApp[]> {
  return invoke<KnownApp[]>("list_known_apps");
}

export type ModeInput = {
  name: string;
  iconDataUrl: string | null;
  modeType: ModeType;
  matchers: AppMatcher[];
};

export function createMode(input: ModeInput): Promise<Mode> {
  return invoke<Mode>("create_mode", input);
}

export function updateMode(id: string, input: ModeInput): Promise<Mode> {
  return invoke<Mode>("update_mode", { id, ...input });
}

export function deleteMode(id: string): Promise<void> {
  return invoke("delete_mode", { id });
}

export function setModeActive(id: string, active: boolean): Promise<Mode> {
  return invoke<Mode>("set_mode_active", { id, active });
}

export function pickExecutablePath(): Promise<string | null> {
  return invoke<string | null>("pick_executable_path");
}

export function pickIconDataUrl(): Promise<string | null> {
  return invoke<string | null>("pick_icon_data_url");
}
