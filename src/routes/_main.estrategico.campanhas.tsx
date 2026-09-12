import { createFileRoute } from "@tanstack/react-router";
import CampanhasPage from "@/pages/estrategico/campanhas/CampanhasPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/estrategico/campanhas")({
  component: () => (
      <ProtectedRoute module="strategic_perf">
        <CampanhasPage />
      </ProtectedRoute>
  ),
});
