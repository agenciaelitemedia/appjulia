import { createFileRoute } from "@tanstack/react-router";
import CRMBuilderPage from "@/pages/crm-builder/CRMBuilderPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/crm-builder")({
  component: () => (
      <ProtectedRoute module="crm_painel">
        <CRMBuilderPage />
      </ProtectedRoute>
  ),
});
