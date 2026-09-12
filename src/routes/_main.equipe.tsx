import { createFileRoute } from "@tanstack/react-router";
import EquipePage from "@/pages/equipe/EquipePage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/equipe")({
  component: () => (
      <ProtectedRoute module="team">
        <EquipePage />
      </ProtectedRoute>
  ),
});
