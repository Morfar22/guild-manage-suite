import { createFileRoute } from "@tanstack/react-router";
import ModmailSettings from "@/pages/ModmailSettings";

export const Route = createFileRoute("/dashboard/modmail")({
  component: ModmailSettings,
});
