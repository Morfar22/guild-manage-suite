import { createFileRoute } from "@tanstack/react-router";
import SuggestionSettings from "@/pages/SuggestionSettings";

export const Route = createFileRoute("/dashboard/suggestions")({
  component: SuggestionSettings,
});
