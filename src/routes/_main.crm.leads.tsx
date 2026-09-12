import { createFileRoute } from "@tanstack/react-router";
import CRMPage from "@/pages/crm/CRMPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/crm/leads")({
  component: () => (
      <ProtectedRoute module="crm_leads">
        <CRMPage />
      </ProtectedRoute>
  ),
});
