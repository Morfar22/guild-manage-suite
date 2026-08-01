import { createFileRoute } from "@tanstack/react-router";
import EmbedBuilder from "@/pages/EmbedBuilder";

export const Route = createFileRoute("/dashboard/embed-builder")({
  component: EmbedBuilder,
});
