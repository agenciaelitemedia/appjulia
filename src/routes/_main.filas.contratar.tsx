import { createFileRoute } from "@tanstack/react-router";
import ContratarFilasPage from "@/pages/filas/contratar/ContratarFilasPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/filas/contratar")({
  component: () => (
      <ProtectedRoute>
        <ContratarFilasPage />
      </ProtectedRoute>
  ),
});
