import { createFileRoute } from "@tanstack/react-router";
import TicketDetail from "@/pages/TicketDetail";

export const Route = createFileRoute("/dashboard/tickets/$ticketId")({
  component: TicketDetail,
});
