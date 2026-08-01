import { createFileRoute } from "@tanstack/react-router";
import JTCSettings from "@/pages/JTCSettings";

export const Route = createFileRoute("/dashboard/jtc")({
  component: JTCSettings,
});
