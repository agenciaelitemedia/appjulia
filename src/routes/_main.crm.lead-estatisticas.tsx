import { createFileRoute } from "@tanstack/react-router";
import CRMStatisticsPage from "@/pages/crm/statistics/CRMStatisticsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/crm/lead-estatisticas")({
  component: () => (
      <ProtectedRoute module="crm_statistics">
        <CRMStatisticsPage />
      </ProtectedRoute>
  ),
});
