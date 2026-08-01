import { createFileRoute } from "@tanstack/react-router";
import TicketSettings from "@/pages/TicketSettings";

export const Route = createFileRoute("/dashboard/tickets/settings")({
  component: TicketSettings,
});
