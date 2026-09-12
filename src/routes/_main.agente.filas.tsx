import { createFileRoute } from "@tanstack/react-router";
import FilasPage from "@/pages/agente/filas/FilasPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/agente/filas")({
  component: () => (
      <ProtectedRoute module="filas">
        <FilasPage />
      </ProtectedRoute>
  ),
});
