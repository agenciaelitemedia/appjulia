import { createFileRoute } from "@tanstack/react-router";
import AgentsList from "@/pages/agents/AgentsList";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/agentes")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <AgentsList />
      </ProtectedRoute>
  ),
});
