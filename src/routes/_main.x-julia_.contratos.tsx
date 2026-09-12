import { createFileRoute } from "@tanstack/react-router";
import XJContractsPage from "@/modules/x-julia/pages/ContractsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/contratos")({
  component: () => (
      <ProtectedRoute module="x_julia_contracts">
        <XJScopeProvider>
          <XJContractsPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
