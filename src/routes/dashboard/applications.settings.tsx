import { createFileRoute } from "@tanstack/react-router";
import ApplicationSettings from "@/pages/ApplicationSettings";

export const Route = createFileRoute("/dashboard/applications/settings")({
  component: ApplicationSettings,
});
