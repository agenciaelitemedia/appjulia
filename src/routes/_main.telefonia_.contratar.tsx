import { createFileRoute } from "@tanstack/react-router";
import ContratarTelefoniaPage from "@/pages/telefonia/contratar/ContratarTelefoniaPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/telefonia_/contratar")({
  component: () => (
      <ProtectedRoute>
        <ContratarTelefoniaPage />
      </ProtectedRoute>
  ),
});
