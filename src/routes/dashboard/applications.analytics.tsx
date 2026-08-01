import { createFileRoute } from "@tanstack/react-router";
import ApplicationAnalytics from "@/pages/ApplicationAnalytics";

export const Route = createFileRoute("/dashboard/applications/analytics")({
  component: ApplicationAnalytics,
});
