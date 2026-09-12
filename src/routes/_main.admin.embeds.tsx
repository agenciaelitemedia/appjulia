import { createFileRoute } from "@tanstack/react-router";
import EmbedManagerPage from "@/pages/admin/embeds/EmbedManagerPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/embeds")({
  component: () => (
      <ProtectedRoute module="admin_embeds">
        <EmbedManagerPage />
      </ProtectedRoute>
  ),
});
