import { createFileRoute } from "@tanstack/react-router";
import MetaTestPage from "@/pages/admin/meta-test/MetaTestPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/meta-test")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <MetaTestPage />
      </ProtectedRoute>
  ),
});
