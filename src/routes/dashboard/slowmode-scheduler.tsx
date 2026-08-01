import { createFileRoute } from "@tanstack/react-router";
import SlowmodeScheduler from "@/pages/SlowmodeScheduler";

export const Route = createFileRoute("/dashboard/slowmode-scheduler")({
  component: SlowmodeScheduler,
});
