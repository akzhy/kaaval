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
