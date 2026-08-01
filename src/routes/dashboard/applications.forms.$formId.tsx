import { createFileRoute } from "@tanstack/react-router";
import ApplicationFormEdit from "@/pages/ApplicationFormEdit";

export const Route = createFileRoute("/dashboard/applications/forms/$formId")({
  component: ApplicationFormEdit,
});
