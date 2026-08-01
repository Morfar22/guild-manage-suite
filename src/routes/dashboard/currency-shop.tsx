import { createFileRoute } from "@tanstack/react-router";
import CurrencyShop from "@/pages/CurrencyShop";

export const Route = createFileRoute("/dashboard/currency-shop")({
  component: CurrencyShop,
});
