import { createFileRoute } from "@tanstack/react-router";
import CRMComercialPage from "@/pages/comercial/crm/CRMComercialPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/comercial/crm")({
  component: () => (
      <ProtectedRoute module="crm_comercial">
        <CRMComercialPage />
      </ProtectedRoute>
  ),
});
