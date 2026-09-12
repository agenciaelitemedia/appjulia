import { createFileRoute } from "@tanstack/react-router";
import MyAgentsPage from "@/pages/agente/meus-agentes/MyAgentsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/agente/meus-agentes")({
  component: () => (
      <ProtectedRoute module="agent_management">
        <MyAgentsPage />
      </ProtectedRoute>
  ),
});
