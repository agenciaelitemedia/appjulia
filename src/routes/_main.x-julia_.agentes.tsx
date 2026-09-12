import { createFileRoute } from "@tanstack/react-router";
import XJAgentsPage from "@/modules/x-julia/pages/AgentsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/agentes")({
  component: () => (
      <ProtectedRoute module="x_julia_agents">
        <XJScopeProvider>
          <XJAgentsPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
