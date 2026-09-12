import { createFileRoute } from "@tanstack/react-router";
import OfficesListPage from "@/modules/escritorios/pages/OfficesListPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/escritorios")({
  component: () => (
      <ProtectedRoute module="escritorios">
        <OfficesListPage />
      </ProtectedRoute>
  ),
});
