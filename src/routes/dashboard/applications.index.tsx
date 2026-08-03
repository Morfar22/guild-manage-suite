import { createFileRoute } from "@tanstack/react-router";
import ApplicationList from "@/pages/ApplicationList";

export const Route = createFileRoute("/dashboard/applications/")({
  component: ApplicationList,
});
