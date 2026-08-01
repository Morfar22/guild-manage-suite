import { createFileRoute } from "@tanstack/react-router";
import YouTubeSettings from "@/pages/YouTubeSettings";

export const Route = createFileRoute("/dashboard/youtube")({
  component: YouTubeSettings,
});
