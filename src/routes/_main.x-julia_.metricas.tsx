import { createFileRoute } from "@tanstack/react-router";
import XJMetricsPage from "@/modules/x-julia/pages/MetricsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/metricas")({
  component: () => (
      <ProtectedRoute module="x_julia_metrics">
        <XJScopeProvider>
          <XJMetricsPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
