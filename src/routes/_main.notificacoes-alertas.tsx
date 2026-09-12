import { createFileRoute } from "@tanstack/react-router";
import NotificacoesAlertasPage from "@/modules/notificacoes-alertas/pages/NotificacoesAlertasPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/notificacoes-alertas")({
  component: () => (
      <ProtectedRoute module="notifications_alerts">
        <NotificacoesAlertasPage />
      </ProtectedRoute>
  ),
});
