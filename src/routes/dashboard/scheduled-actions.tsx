import { createFileRoute } from "@tanstack/react-router";
import ScheduledActions from "@/pages/ScheduledActions";

export const Route = createFileRoute("/dashboard/scheduled-actions")({
  component: ScheduledActions,
});
