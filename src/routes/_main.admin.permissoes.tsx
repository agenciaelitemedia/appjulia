import { createFileRoute } from "@tanstack/react-router";
import PermissoesPage from "@/pages/admin/permissoes/PermissoesPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/permissoes")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <PermissoesPage />
      </ProtectedRoute>
  ),
});
