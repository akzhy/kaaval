import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import RootLayout from "./root";
import DashboardPage from "@/features/dashboard/routes/DashboardPage";
import ActivityLogPage from "@/features/activity-log/routes/ActivityLogPage";
import ModesPage from "@/features/modes/routes/ModesPage";
import SettingsPage from "@/features/settings/routes/SettingsPage";

const rootRoute = createRootRoute({ component: RootLayout });

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const modesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/modes",
  component: ModesPage,
});

const activityLogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity-log",
  component: ActivityLogPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  modesRoute,
  activityLogRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
