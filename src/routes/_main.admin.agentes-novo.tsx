import { createFileRoute } from "@tanstack/react-router";
import CreateAgentPage from "@/pages/agents/CreateAgentPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/agentes-novo")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <CreateAgentPage />
      </ProtectedRoute>
  ),
});
