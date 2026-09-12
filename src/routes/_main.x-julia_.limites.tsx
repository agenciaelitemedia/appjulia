import { createFileRoute } from "@tanstack/react-router";
import XJLimitsPage from "@/modules/x-julia/pages/LimitsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/limites")({
  component: () => (
      <ProtectedRoute module="x_julia_limits">
        <XJScopeProvider>
          <XJLimitsPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
