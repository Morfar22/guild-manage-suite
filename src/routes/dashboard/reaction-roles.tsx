import { createFileRoute } from "@tanstack/react-router";
import ReactionRoles from "@/pages/ReactionRoles";

export const Route = createFileRoute("/dashboard/reaction-roles")({
  component: ReactionRoles,
});
