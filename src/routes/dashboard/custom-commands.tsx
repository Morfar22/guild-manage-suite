import { createFileRoute } from "@tanstack/react-router";
import CustomCommands from "@/pages/CustomCommands";

export const Route = createFileRoute("/dashboard/custom-commands")({
  component: CustomCommands,
});
