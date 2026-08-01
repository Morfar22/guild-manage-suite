import { createFileRoute } from "@tanstack/react-router";
import GlobalBanReports from "@/pages/GlobalBanReports";

export const Route = createFileRoute("/admin/global-bans")({
  component: GlobalBanReports,
});
