import { createFileRoute } from "@tanstack/react-router";
import AdvboxQueriesPage from "@/pages/advbox/QueriesPage";

export const Route = createFileRoute("/_main/advbox_/consultas")({
  component: AdvboxQueriesPage,
});
