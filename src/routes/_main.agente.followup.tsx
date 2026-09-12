import { createFileRoute } from "@tanstack/react-router";
import FollowupPage from "@/pages/agente/followup/FollowupPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/agente/followup")({
  component: () => (
      <ProtectedRoute module="followup">
        <FollowupPage />
      </ProtectedRoute>
  ),
});
