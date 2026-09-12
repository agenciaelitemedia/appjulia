import { createFileRoute } from "@tanstack/react-router";
import EmbedPage from "@/pages/embed/EmbedPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/sys/$code")({
  component: () => (
      <ProtectedRoute>
        <EmbedPage />
      </ProtectedRoute>
  ),
});
