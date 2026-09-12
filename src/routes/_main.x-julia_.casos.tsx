import { createFileRoute } from "@tanstack/react-router";
import XJCasesPage from "@/modules/x-julia/pages/CasesPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/casos")({
  component: () => (
      <ProtectedRoute module="x_julia_cases">
        <XJScopeProvider>
          <XJCasesPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
