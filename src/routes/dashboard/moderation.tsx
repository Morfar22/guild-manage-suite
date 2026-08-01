import { createFileRoute } from "@tanstack/react-router";
import Moderation from "@/pages/Moderation";

export const Route = createFileRoute("/dashboard/moderation")({
  component: Moderation,
});
