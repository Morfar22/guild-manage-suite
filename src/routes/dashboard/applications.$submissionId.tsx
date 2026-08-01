import { createFileRoute } from "@tanstack/react-router";
import ApplicationReview from "@/pages/ApplicationReview";

export const Route = createFileRoute("/dashboard/applications/$submissionId")({
  component: ApplicationReview,
});
