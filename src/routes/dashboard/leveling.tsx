import { createFileRoute } from "@tanstack/react-router";
import Leveling from "@/pages/Leveling";

export const Route = createFileRoute("/dashboard/leveling")({
  component: Leveling,
});
