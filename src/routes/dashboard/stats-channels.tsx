import { createFileRoute } from "@tanstack/react-router";
import StatsChannels from "@/pages/StatsChannels";

export const Route = createFileRoute("/dashboard/stats-channels")({
  component: StatsChannels,
});
