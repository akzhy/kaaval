import { useEffect, useRef } from "react";
import { Outlet } from "@tanstack/react-router";
import { css } from "@flairjs/client";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { relaunchAsAdmin } from "@/utils/api";
import { useNetworkStore } from "@/store/networkStore";

const POLL_INTERVAL_MS = 2000;

function RootLayout() {
  const refresh = useNetworkStore((state) => state.refresh);
  const error = useNetworkStore((state) => state.error);
  const throughputMbps = useNetworkStore(
    (state) => state.dashboardStats.throughput_mbps,
  );
  const isAdmin = useNetworkStore((state) => state.isAdmin);
  const loading = useNetworkStore((state) => state.loading);
  const startupPromptedRef = useRef(false);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (loading || isAdmin || startupPromptedRef.current) {
      return;
    }

    startupPromptedRef.current = true;
    const confirmed = window.confirm(
      "Kaaval requires Administrator privileges. Relaunch as Administrator now?",
    );
    if (!confirmed) {
      return;
    }

    relaunchAsAdmin().catch((e) => {
      console.error("failed to relaunch as administrator", e);
    });
  }, [isAdmin, loading]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <TopBar secure={!error} isAdmin={isAdmin} throughputMbps={throughputMbps} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

RootLayout.globalFlair = css`
  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    height: 100%;
  }

  body {
    margin: 0;
    background-color: $colors.surface;
    color: $colors.text;
    font-family: $fonts.family;
    -webkit-font-smoothing: antialiased;
  }
`;

RootLayout.flair = css`
  .app-shell {
    display: flex;
    height: 100vh;
    width: 100%;
  }

  .app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .app-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
  }
`;

export default RootLayout;
