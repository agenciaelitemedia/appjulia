import { createFileRoute } from "@tanstack/react-router";
import ContratoTemplatePage from "@/pages/admin/contrato/ContratoTemplatePage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/contrato-template")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <ContratoTemplatePage />
      </ProtectedRoute>
  ),
});
