import { createFileRoute } from "@tanstack/react-router";
import DashboardNotifications from "@/pages/DashboardNotifications";

export const Route = createFileRoute("/dashboard/notifications")({
  component: DashboardNotifications,
});
