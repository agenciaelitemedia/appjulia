import { createFileRoute } from "@tanstack/react-router";
import XJSessionDetailPage from "@/modules/x-julia/pages/SessionDetailPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/atendimentos_/$sessionId")({
  component: () => (
      <ProtectedRoute module="x_julia_sessions">
        <XJScopeProvider>
          <XJSessionDetailPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
