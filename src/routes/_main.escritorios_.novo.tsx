import { createFileRoute } from "@tanstack/react-router";
import CreateOfficePage from "@/modules/escritorios/pages/CreateOfficePage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/escritorios_/novo")({
  component: () => (
      <ProtectedRoute module="escritorios">
        <CreateOfficePage />
      </ProtectedRoute>
  ),
});
