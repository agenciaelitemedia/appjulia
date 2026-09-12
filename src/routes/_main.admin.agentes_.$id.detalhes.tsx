import { createFileRoute } from "@tanstack/react-router";
import AgentDetailsPage from "@/pages/agents/AgentDetailsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/agentes_/$id/detalhes")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <AgentDetailsPage />
      </ProtectedRoute>
  ),
});
