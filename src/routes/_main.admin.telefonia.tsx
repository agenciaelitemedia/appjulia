import { createFileRoute } from "@tanstack/react-router";
import TelefoniaAdminPage from "@/pages/admin/telefonia/TelefoniaAdminPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/telefonia")({
  component: () => (
      <ProtectedRoute module="telephony_admin">
        <TelefoniaAdminPage />
      </ProtectedRoute>
  ),
});
