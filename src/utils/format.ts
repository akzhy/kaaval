export function normalizePathKey(path: string): string {
  const trimmed = path.trim();
  const withoutPrefix = trimmed.startsWith("\\\\?\\") ? trimmed.slice(4) : trimmed;
  return withoutPrefix.replace(/\//g, "\\").toLowerCase();
}

export function formatMbps(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 Mbps";
  }
  return `${value.toFixed(1)} Mbps`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
