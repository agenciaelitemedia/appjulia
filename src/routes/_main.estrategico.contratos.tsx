import { createFileRoute } from "@tanstack/react-router";
import ContratosPage from "@/pages/estrategico/contratos/ContratosPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/estrategico/contratos")({
  component: () => (
      <ProtectedRoute module="strategic_contract">
        <ContratosPage />
      </ProtectedRoute>
  ),
});
