import { createFileRoute } from "@tanstack/react-router";
import XJSessionsManagePage from "@/modules/x-julia/pages/SessionsManagePage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/sessoes")({
  component: () => (
      <ProtectedRoute module="x_julia_sessions_manage">
        <XJScopeProvider>
          <XJSessionsManagePage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
