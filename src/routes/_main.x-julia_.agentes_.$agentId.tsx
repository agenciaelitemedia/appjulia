import { createFileRoute } from "@tanstack/react-router";
import XJAgentEditorPage from "@/modules/x-julia/pages/AgentEditorPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/agentes_/$agentId")({
  component: () => (
      <ProtectedRoute module="x_julia_agents">
        <XJScopeProvider>
          <XJAgentEditorPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
