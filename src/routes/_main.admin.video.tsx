import { createFileRoute } from "@tanstack/react-router";
import VideoAdminPage from "@/pages/admin/video/VideoAdminPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/video")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <VideoAdminPage />
      </ProtectedRoute>
  ),
});
