import { createFileRoute } from "@tanstack/react-router";
import RaidProtection from "@/pages/RaidProtection";

export const Route = createFileRoute("/dashboard/raid-protection")({
  component: RaidProtection,
});
