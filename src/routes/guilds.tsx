import { createFileRoute } from "@tanstack/react-router";
import GuildSelect from "@/pages/GuildSelect";

export const Route = createFileRoute("/guilds")({
  component: GuildSelect,
});
