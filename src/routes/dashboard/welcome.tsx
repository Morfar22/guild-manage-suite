import { createFileRoute } from "@tanstack/react-router";
import WelcomeSettings from "@/pages/WelcomeSettings";

export const Route = createFileRoute("/dashboard/welcome")({
  component: WelcomeSettings,
});
