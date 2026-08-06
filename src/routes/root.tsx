import { useEffect, useRef, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { css } from "@flairjs/client";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import logo from "@/assets/logo_64x64.png";
import { relaunchAsAdmin } from "@/utils/api";
import { checkForUpdatesSilently } from "@/utils/updater";
import { useNetworkStore } from "@/store/networkStore";

function RootLayout() {
  const refresh = useNetworkStore((state) => state.refresh);
  const error = useNetworkStore((state) => state.error);
  const throughputMbps = useNetworkStore(
    (state) => state.dashboardStats.throughput_mbps,
  );
  const isAdmin = useNetworkStore((state) => state.isAdmin);
  const loading = useNetworkStore((state) => state.loading);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const startupPromptedRef = useRef(false);

  useEffect(() => {
    refresh();
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

  useEffect(() => {
    checkForUpdatesSilently().catch((error) => {
      console.error("silent update check failed", error);
    });
  }, []);

  useEffect(() => {
    const minimumSplashTimer = window.setTimeout(() => {
      setMinimumSplashElapsed(true);
    }, 500);

    return () => {
      window.clearTimeout(minimumSplashTimer);
    };
  }, []);

  if (loading || !minimumSplashElapsed) {
    return (
      <div className="app-splash" role="status" aria-label="Loading Kaaval">
        <img src={logo} alt="Kaaval logo" className="app-splash-logo" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <TopBar
          secure={!error}
          isAdmin={isAdmin}
          throughputMbps={throughputMbps}
        />
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

  body[data-theme="dark"] .app-splash {
    background: #000000;
  }

  body[data-theme="light"] .app-splash {
    background: #ffffff;
  }
`;

RootLayout.flair = css`
  .app-splash {
    height: 100vh;
    width: 100%;
    display: grid;
    place-items: center;
  }

  .app-splash-logo {
    width: 96px;
    height: 96px;
    object-fit: contain;
    image-rendering: -webkit-optimize-contrast;
  }

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
