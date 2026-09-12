import { createFileRoute } from "@tanstack/react-router";
import AdvboxProcessesPage from "@/pages/advbox/ProcessesPage";

export const Route = createFileRoute("/_main/advbox_/processos")({
  component: AdvboxProcessesPage,
});
