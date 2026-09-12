import { createFileRoute } from "@tanstack/react-router";
import XJDashboardPage from "@/modules/x-julia/pages/DashboardPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia")({
  component: () => (
      <ProtectedRoute module="x_julia">
        <XJScopeProvider>
          <XJDashboardPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
