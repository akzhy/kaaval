export type NetworkRequest = {
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

export type ApplicationGroup = {
  appPath: string;
  appName: string;
  blocked: boolean;
  requestCount: number;
  pids: number[];
  protocols: string[];
  endpoints: string[];
  rows: NetworkRequest[];
};

export type DashboardStats = {
  throughput_mbps: number;
  active_sessions: number;
  blocked_today: number;
};

export type ThemePreference = "system" | "dark" | "light";

export type MatcherKind = "path" | "directory" | "name";

export type AppMatcher = {
  kind: MatcherKind;
  value: string;
};

export type ModeType = "block_all_except" | "block_these";

export type Mode = {
  id: string;
  name: string;
  description: string | null;
  icon_data_url: string | null;
  mode_type: ModeType;
  matchers: AppMatcher[];
  active: boolean;
};

export type KnownApp = {
  path: string;
  name: string;
  last_seen_secs: number;
};

export type AppSettings = {
  turn_off_modes_and_filters_on_close: boolean;
  theme_preference: ThemePreference;
};

export type AdminStatus = {
  is_admin: boolean;
};

export type RecordingStatus = {
  is_recording: boolean;
  started_at_ms: number | null;
  event_count: number;
};

export type RecordedNetworkEvent = NetworkRequest & {
  captured_at_ms: number;
};

export type RecordingSummary = {
  id: string;
  name: string;
  started_at_ms: number;
  stopped_at_ms: number;
  event_count: number;
};

export type RecordingFile = {
  schema_version: number;
  id: string;
  name: string;
  started_at_ms: number;
  stopped_at_ms: number;
  events: RecordedNetworkEvent[];
};
