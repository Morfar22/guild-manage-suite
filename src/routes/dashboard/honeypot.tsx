import { createFileRoute } from "@tanstack/react-router";
import Honeypot from "@/pages/Honeypot";

export const Route = createFileRoute("/dashboard/honeypot")({
  head: () => ({
    meta: [
      { title: "Honeypot – Fang hackede konti | NetHost Bot" },
      { name: "description", content: "Opsæt en honeypot-kanal der automatisk kicker og rapporterer hackede konti til det globale ban-system." },
    ],
  }),
  component: Honeypot,
});
