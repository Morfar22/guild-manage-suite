import { createFileRoute } from "@tanstack/react-router";
import TikTokSettings from "@/pages/TikTokSettings";

export const Route = createFileRoute("/dashboard/tiktok")({
  component: TikTokSettings,
});
