import { invoke } from "@tauri-apps/api/core";
import type { DashboardStats, NetworkRequest } from "./types";

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
