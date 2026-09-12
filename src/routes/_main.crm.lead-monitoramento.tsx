import { createFileRoute } from "@tanstack/react-router";
import CRMMonitoringPage from "@/pages/crm/monitoring/CRMMonitoringPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/crm/lead-monitoramento")({
  component: () => (
      <ProtectedRoute module="crm_monitoring">
        <CRMMonitoringPage />
      </ProtectedRoute>
  ),
});
