import { createFileRoute } from "@tanstack/react-router";
import XJOfficesPage from "@/modules/x-julia/pages/OfficesPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/escritorios")({
  component: () => (
      <ProtectedRoute module="x_julia_offices">
        <XJScopeProvider>
          <XJOfficesPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
