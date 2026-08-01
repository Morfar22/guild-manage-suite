import { createFileRoute } from "@tanstack/react-router";
import DashboardChangelog from "@/pages/DashboardChangelog";

export const Route = createFileRoute("/dashboard/changelog")({
  component: DashboardChangelog,
});
