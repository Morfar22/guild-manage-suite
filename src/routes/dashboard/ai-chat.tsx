import { createFileRoute } from "@tanstack/react-router";
import AIChatSettings from "@/pages/AIChatSettings";

export const Route = createFileRoute("/dashboard/ai-chat")({
  component: AIChatSettings,
});
