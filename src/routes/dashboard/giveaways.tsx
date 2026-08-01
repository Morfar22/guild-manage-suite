import { createFileRoute } from "@tanstack/react-router";
import Giveaways from "@/pages/Giveaways";

export const Route = createFileRoute("/dashboard/giveaways")({
  component: Giveaways,
});
