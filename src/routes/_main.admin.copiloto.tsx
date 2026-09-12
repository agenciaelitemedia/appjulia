import { createFileRoute } from "@tanstack/react-router";
import CopilotAdminPage from "@/pages/admin/copiloto/CopilotAdminPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/copiloto")({
  component: () => (
      <ProtectedRoute module="copilot_admin">
        <CopilotAdminPage />
      </ProtectedRoute>
  ),
});
