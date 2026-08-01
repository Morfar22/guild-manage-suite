import { createFileRoute } from "@tanstack/react-router";
import AutoResponders from "@/pages/AutoResponders";

export const Route = createFileRoute("/dashboard/auto-responders")({
  component: AutoResponders,
});
