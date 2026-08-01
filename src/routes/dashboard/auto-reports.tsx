import { createFileRoute } from "@tanstack/react-router";
import AutoReports from "@/pages/AutoReports";

export const Route = createFileRoute("/dashboard/auto-reports")({
  component: AutoReports,
});
