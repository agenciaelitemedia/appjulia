import { createFileRoute } from "@tanstack/react-router";
import TvMasterPage from "@/pages/tv/TvMasterPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/tv/master")({
  component: () => (
      <ProtectedRoute>
        <TvMasterPage />
      </ProtectedRoute>
  ),
});
