import { createFileRoute } from "@tanstack/react-router";
import WavoipAdminPage from "@/pages/admin/wavoip/WavoipAdminPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/wavoip")({
  component: () => (
      <ProtectedRoute module="wavoip_admin">
        <WavoipAdminPage />
      </ProtectedRoute>
  ),
});
