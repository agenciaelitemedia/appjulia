import { createFileRoute } from "@tanstack/react-router";
import ContractNotificationsPage from "@/pages/contract-notifications/ContractNotificationsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/notificacoes-contrato")({
  component: () => (
      <ProtectedRoute module="contract_notifications">
        <ContractNotificationsPage />
      </ProtectedRoute>
  ),
});
