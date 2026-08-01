import { createFileRoute } from "@tanstack/react-router";
import AIAutomodSettings from "@/pages/AIAutomodSettings";

export const Route = createFileRoute("/dashboard/ai-automod")({
  component: AIAutomodSettings,
});
