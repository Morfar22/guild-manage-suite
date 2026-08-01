import { createFileRoute } from "@tanstack/react-router";
import AutoModeration from "@/pages/AutoModeration";

export const Route = createFileRoute("/dashboard/automod")({
  component: AutoModeration,
});
