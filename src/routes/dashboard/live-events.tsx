import { createFileRoute } from "@tanstack/react-router";
import RealtimeEventDashboard from "@/pages/RealtimeEventDashboard";

export const Route = createFileRoute("/dashboard/live-events")({
  component: RealtimeEventDashboard,
});
