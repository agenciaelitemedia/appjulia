import { createFileRoute } from "@tanstack/react-router";
import MonitoramentoPage from "@/pages/admin/monitoramento/MonitoramentoPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/monitoramento")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <MonitoramentoPage />
      </ProtectedRoute>
  ),
});
