import { createFileRoute } from "@tanstack/react-router";
import DesempenhoPage from "@/pages/estrategico/desempenho/DesempenhoPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/estrategico/desempenho")({
  component: () => (
      <ProtectedRoute module="strategic_perf">
        <DesempenhoPage />
      </ProtectedRoute>
  ),
});
