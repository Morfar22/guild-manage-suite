import { createFileRoute } from "@tanstack/react-router";
import BirthdayTracker from "@/pages/BirthdayTracker";

export const Route = createFileRoute("/dashboard/birthdays")({
  component: BirthdayTracker,
});
