import { createFileRoute } from "@tanstack/react-router";
import Reminders from "@/pages/Reminders";

export const Route = createFileRoute("/dashboard/reminders")({
  component: Reminders,
});
