import { createFileRoute } from "@tanstack/react-router";
import HelpCenterPage from "@/pages/ajuda/HelpCenterPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/ajuda")({
  component: () => (
      <ProtectedRoute module="help_center">
        <HelpCenterPage />
      </ProtectedRoute>
  ),
});
