import { createFileRoute } from "@tanstack/react-router";
import BotTestPanel from "@/pages/BotTestPanel";

export const Route = createFileRoute("/dashboard/test-panel")({
  component: BotTestPanel,
});
