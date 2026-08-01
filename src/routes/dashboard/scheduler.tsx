import { createFileRoute } from "@tanstack/react-router";
import SchedulerSettings from "@/pages/SchedulerSettings";

export const Route = createFileRoute("/dashboard/scheduler")({
  component: SchedulerSettings,
});
