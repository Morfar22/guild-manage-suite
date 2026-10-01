import { createFileRoute } from "@tanstack/react-router";
import OperationsCenter from "@/pages/OperationsCenter";

export const Route = createFileRoute("/dashboard/operations")({
  component: OperationsCenter,
});
