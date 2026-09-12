import { createFileRoute } from "@tanstack/react-router";
import MyAgentEditPage from "@/pages/agente/meus-agentes/MyAgentEditPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/agente/meus-agentes_/$codAgent/editar")({
  component: () => (
      <ProtectedRoute module="agent_management">
        <MyAgentEditPage />
      </ProtectedRoute>
  ),
});
