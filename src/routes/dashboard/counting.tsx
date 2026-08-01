import { createFileRoute } from "@tanstack/react-router";
import CountingChannel from "@/pages/CountingChannel";

export const Route = createFileRoute("/dashboard/counting")({
  component: CountingChannel,
});
