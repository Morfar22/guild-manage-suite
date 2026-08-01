import { createFileRoute } from "@tanstack/react-router";
import VerificationSettings from "@/pages/VerificationSettings";

export const Route = createFileRoute("/dashboard/verification")({
  component: VerificationSettings,
});
