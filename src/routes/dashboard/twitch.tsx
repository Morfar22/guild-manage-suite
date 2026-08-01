import { createFileRoute } from "@tanstack/react-router";
import TwitchSettings from "@/pages/TwitchSettings";

export const Route = createFileRoute("/dashboard/twitch")({
  component: TwitchSettings,
});
