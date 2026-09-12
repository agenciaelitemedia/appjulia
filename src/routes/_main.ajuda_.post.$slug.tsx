import { createFileRoute } from "@tanstack/react-router";
import HelpPostPage from "@/pages/ajuda/HelpPostPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/ajuda_/post/$slug")({
  component: () => (
      <ProtectedRoute module="help_center">
        <HelpPostPage />
      </ProtectedRoute>
  ),
});
