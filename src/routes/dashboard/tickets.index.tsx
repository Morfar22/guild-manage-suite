import { createFileRoute } from "@tanstack/react-router";
import Tickets from "@/pages/Tickets";

export const Route = createFileRoute("/dashboard/tickets/")({
  component: Tickets,
});
