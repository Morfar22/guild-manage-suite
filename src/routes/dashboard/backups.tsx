import { createFileRoute } from "@tanstack/react-router";
import BackupSettings from "@/pages/BackupSettings";

export const Route = createFileRoute("/dashboard/backups")({
  component: BackupSettings,
});
