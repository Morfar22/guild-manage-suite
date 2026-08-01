import { createFileRoute } from "@tanstack/react-router";
import FiveMSettings from "@/pages/FiveMSettings";

export const Route = createFileRoute("/dashboard/fivem")({
  component: FiveMSettings,
});
