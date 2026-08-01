import { createFileRoute } from "@tanstack/react-router";
import Polls from "@/pages/Polls";

export const Route = createFileRoute("/dashboard/polls")({
  component: Polls,
});
