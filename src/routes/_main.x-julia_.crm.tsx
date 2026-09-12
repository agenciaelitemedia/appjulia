import { createFileRoute } from "@tanstack/react-router";
import XJCrmPage from "@/modules/x-julia/pages/CrmPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/crm")({
  component: () => (
      <ProtectedRoute module="x_julia_crm">
        <XJScopeProvider>
          <XJCrmPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
