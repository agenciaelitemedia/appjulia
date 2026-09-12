import { createFileRoute } from "@tanstack/react-router";
import CrmNotificacoesStandalonePage from "@/modules/notificacoes-alertas/pages/CrmNotificacoesStandalonePage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/crm-notificacoes")({
  component: () => (
      <ProtectedRoute module="notifications_alerts">
        <CrmNotificacoesStandalonePage />
      </ProtectedRoute>
  ),
});
