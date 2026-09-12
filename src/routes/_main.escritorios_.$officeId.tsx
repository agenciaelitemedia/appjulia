import { createFileRoute } from "@tanstack/react-router";
import OfficeDetailsPage from "@/modules/escritorios/pages/OfficeDetailsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/escritorios_/$officeId")({
  component: () => (
      <ProtectedRoute module="escritorios">
        <OfficeDetailsPage />
      </ProtectedRoute>
  ),
});
