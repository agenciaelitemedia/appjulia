import { createFileRoute } from "@tanstack/react-router";
import ContratarVideoPage from "@/pages/video/contratar/ContratarVideoPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/video/contratar")({
  component: () => (
      <ProtectedRoute>
        <ContratarVideoPage />
      </ProtectedRoute>
  ),
});
