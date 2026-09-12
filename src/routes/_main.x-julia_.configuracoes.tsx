import { createFileRoute } from "@tanstack/react-router";
import XJSettingsPage from "@/modules/x-julia/pages/SettingsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/configuracoes")({
  component: () => (
      <ProtectedRoute module="x_julia_settings">
        <XJScopeProvider>
          <XJSettingsPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
