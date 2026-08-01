import { createFileRoute } from "@tanstack/react-router";
import ConfessionSystem from "@/pages/ConfessionSystem";

export const Route = createFileRoute("/dashboard/confessions")({
  component: ConfessionSystem,
});
