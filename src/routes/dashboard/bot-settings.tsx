import { createFileRoute } from "@tanstack/react-router";
import BotSettings from "@/pages/BotSettings";

export const Route = createFileRoute("/dashboard/bot-settings")({
  component: BotSettings,
});
