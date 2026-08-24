import { createFileRoute } from "@tanstack/react-router";
import Resources from "@/pages/Resources";

export const Route = createFileRoute("/dashboard/resources")({
  component: Resources,
  head: () => ({
    meta: [
      { title: "Ressourceoversigt | NetHost Bot Dashboard" },
      {
        name: "description",
        content:
          "Se diskplads, CPU- og RAM-forbrug samt botstatus for hver Discord-server i realtid.",
      },
      { property: "og:title", content: "Ressourceoversigt | NetHost Bot Dashboard" },
      {
        property: "og:description",
        content:
          "Overvåg diskplads, CPU/RAM og botstatus pr. server direkte i dashboardet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
