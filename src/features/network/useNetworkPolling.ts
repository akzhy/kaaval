import { useEffect } from "react";
import { useNetworkStore } from "@/store/networkStore";

const POLL_INTERVAL_MS = 2000;

export function useNetworkPolling() {
  const refresh = useNetworkStore((state) => state.refresh);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [refresh]);
}
