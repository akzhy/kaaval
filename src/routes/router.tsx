import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import RootLayout from "./root";
import DashboardPage from "@/features/dashboard/routes/DashboardPage";
import ActivityLogPage from "@/features/activity-log/routes/ActivityLogPage";
import RecordingsPage from "@/features/activity-log/routes/RecordingsPage";
import RecordingDetailPage from "@/features/activity-log/routes/RecordingDetailPage";
import ModesPage from "@/features/modes/routes/ModesPage";
import CommunityModesPage from "../features/modes/routes/CommunityModesPage";
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

const communityModesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/modes/community",
  component: CommunityModesPage,
});

const activityLogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity-log",
  component: ActivityLogPage,
});

const recordingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity-log/recordings",
  component: RecordingsPage,
});

const recordingDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity-log/recordings/$recordingId",
  component: RecordingDetailPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  modesRoute,
  communityModesRoute,
  activityLogRoute,
  recordingsRoute,
  recordingDetailRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
