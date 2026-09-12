import { createFileRoute } from "@tanstack/react-router";
import OfficeDashboardPage from "@/modules/escritorios/pages/OfficeDashboardPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/painel-atendimento")({
  component: () => (
      <ProtectedRoute>
        <OfficeDashboardPage />
      </ProtectedRoute>
  ),
});
