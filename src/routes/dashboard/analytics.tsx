import { createFileRoute } from "@tanstack/react-router";
import Analytics from "@/pages/Analytics";

export const Route = createFileRoute("/dashboard/analytics")({
  component: Analytics,
});
