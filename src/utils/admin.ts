import { ADMIN_REQUIRED_PREFIX } from "@/utils/constants";

export function isAdminRequiredError(value: unknown): boolean {
  const text = value instanceof Error ? value.message : String(value);
  return text.startsWith(ADMIN_REQUIRED_PREFIX);
}