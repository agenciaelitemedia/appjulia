import { createFileRoute } from "@tanstack/react-router";
import OperacoesMonitorPage from "@/pages/admin/operacoes/OperacoesMonitorPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/operacoes")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <OperacoesMonitorPage />
      </ProtectedRoute>
  ),
});
