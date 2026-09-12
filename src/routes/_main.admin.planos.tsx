import { createFileRoute } from "@tanstack/react-router";
import PlanosPage from "@/pages/admin/planos/PlanosPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/planos")({
  component: () => (
      <ProtectedRoute module="julia_plans">
        <PlanosPage />
      </ProtectedRoute>
  ),
});
