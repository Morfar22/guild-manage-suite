import { createFileRoute } from "@tanstack/react-router";
import RoleAnalytics from "@/pages/RoleAnalytics";

export const Route = createFileRoute("/dashboard/role-analytics")({
  component: RoleAnalytics,
});
