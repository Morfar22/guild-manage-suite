import { createFileRoute } from "@tanstack/react-router";
import GlobalBanReports from "@/pages/GlobalBanReports";

export const Route = createFileRoute("/dashboard/global-bans")({
  component: GlobalBanReports,
});
