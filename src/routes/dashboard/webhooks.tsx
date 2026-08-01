import { createFileRoute } from "@tanstack/react-router";
import WebhookManager from "@/pages/WebhookManager";

export const Route = createFileRoute("/dashboard/webhooks")({
  component: WebhookManager,
});
