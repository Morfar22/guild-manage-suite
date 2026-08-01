import { createFileRoute } from "@tanstack/react-router";
import MusicQuizSettings from "@/pages/MusicQuizSettings";

export const Route = createFileRoute("/dashboard/music-quiz")({
  component: MusicQuizSettings,
});
