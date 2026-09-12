import { createFileRoute } from "@tanstack/react-router";
import MetaAdsTestPage from "@/pages/admin/meta-ads/MetaAdsTestPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/meta-ads")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <MetaAdsTestPage />
      </ProtectedRoute>
  ),
});
