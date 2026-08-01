import { createFileRoute } from "@tanstack/react-router";
import StarboardSettings from "@/pages/StarboardSettings";

export const Route = createFileRoute("/dashboard/starboard")({
  component: StarboardSettings,
});
