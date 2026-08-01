import { createFileRoute } from "@tanstack/react-router";
import MemberActivityHeatmap from "@/pages/MemberActivityHeatmap";

export const Route = createFileRoute("/dashboard/activity-heatmap")({
  component: MemberActivityHeatmap,
});
