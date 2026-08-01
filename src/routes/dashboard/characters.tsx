import { createFileRoute } from "@tanstack/react-router";
import Characters from "@/pages/Characters";

export const Route = createFileRoute("/dashboard/characters")({
  component: Characters,
});
