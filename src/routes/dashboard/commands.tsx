import { createFileRoute } from "@tanstack/react-router";
import Commands from "@/pages/Commands";

export const Route = createFileRoute("/dashboard/commands")({
  component: Commands,
});
