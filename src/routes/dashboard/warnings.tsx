import { createFileRoute } from "@tanstack/react-router";
import WarningsSettings from "@/pages/WarningsSettings";

export const Route = createFileRoute("/dashboard/warnings")({
  component: WarningsSettings,
});
