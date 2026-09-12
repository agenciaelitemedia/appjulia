import { createFileRoute } from "@tanstack/react-router";
import ComprarPage from "@/pages/comprar/ComprarPage";

export const Route = createFileRoute("/comprar")({
  component: ComprarPage,
});
