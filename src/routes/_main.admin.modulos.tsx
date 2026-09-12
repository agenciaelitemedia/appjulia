import { createFileRoute } from "@tanstack/react-router";
import ModulosPage from "@/pages/admin/modulos/ModulosPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/modulos")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <ModulosPage />
      </ProtectedRoute>
  ),
});
