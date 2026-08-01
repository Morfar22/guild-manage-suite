import { createFileRoute } from "@tanstack/react-router";
import BotHealth from "@/pages/BotHealth";

export const Route = createFileRoute("/dashboard/bot-health")({
  component: BotHealth,
});
