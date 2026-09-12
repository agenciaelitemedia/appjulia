import { createFileRoute } from "@tanstack/react-router";
import XJAgendaPage from "@/modules/x-julia/pages/AgendaPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { XJScopeProvider } from "@/modules/x-julia/context/XJScopeContext";

export const Route = createFileRoute("/_main/x-julia_/agenda")({
  component: () => (
      <ProtectedRoute module="x_julia_agenda">
        <XJScopeProvider>
          <XJAgendaPage />
        </XJScopeProvider>
      </ProtectedRoute>
  ),
});
