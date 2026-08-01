import { createFileRoute } from "@tanstack/react-router";
import Economy from "@/pages/Economy";

export const Route = createFileRoute("/dashboard/economy")({
  component: Economy,
});
