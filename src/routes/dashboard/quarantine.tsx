import { createFileRoute } from "@tanstack/react-router";
import QuarantineSystem from "@/pages/QuarantineSystem";

export const Route = createFileRoute("/dashboard/quarantine")({
  component: QuarantineSystem,
});
