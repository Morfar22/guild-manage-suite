import { createFileRoute } from "@tanstack/react-router";
import Modules from "@/pages/Modules";

export const Route = createFileRoute("/dashboard/modules")({
  component: Modules,
});
