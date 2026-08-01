import { createFileRoute } from "@tanstack/react-router";
import TebexSettings from "@/pages/TebexSettings";

export const Route = createFileRoute("/dashboard/tebex")({
  component: TebexSettings,
});
