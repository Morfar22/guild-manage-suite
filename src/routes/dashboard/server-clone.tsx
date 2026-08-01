import { createFileRoute } from "@tanstack/react-router";
import ServerClone from "@/pages/ServerClone";

export const Route = createFileRoute("/dashboard/server-clone")({
  component: ServerClone,
});
