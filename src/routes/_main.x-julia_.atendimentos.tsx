import { createFileRoute } from "@tanstack/react-router";
import XJSessionsPage from "@/modules/x-julia/pages/SessionsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/atendimentos")({
  component: () => (
      <ProtectedRoute module="x_julia_sessions">
        <XJScopeProvider>
          <XJSessionsPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
