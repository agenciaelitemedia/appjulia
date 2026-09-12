import { createFileRoute } from "@tanstack/react-router";
import EditAgentPage from "@/pages/agents/EditAgentPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/agentes_/$id/editar")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <EditAgentPage />
      </ProtectedRoute>
  ),
});
