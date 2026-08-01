import { createFileRoute } from "@tanstack/react-router";
import InviteTracker from "@/pages/InviteTracker";

export const Route = createFileRoute("/dashboard/invite-tracker")({
  component: InviteTracker,
});
