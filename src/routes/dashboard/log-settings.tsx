import { createFileRoute } from "@tanstack/react-router";
import LogSettings from "@/pages/LogSettings";

export const Route = createFileRoute("/dashboard/log-settings")({
  component: LogSettings,
});
