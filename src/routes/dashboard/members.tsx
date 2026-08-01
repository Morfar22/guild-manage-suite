import { createFileRoute } from "@tanstack/react-router";
import Members from "@/pages/Members";

export const Route = createFileRoute("/dashboard/members")({
  component: Members,
});
