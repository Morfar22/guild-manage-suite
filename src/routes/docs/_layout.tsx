import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/DocsLayout";

export const Route = createFileRoute("/docs/_layout")({
  component: DocsLayoutWrapper,
});

function DocsLayoutWrapper() {
  return (
    <DocsLayout>
      <Outlet />
    </DocsLayout>
  );
}
