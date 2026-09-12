import { createFileRoute } from "@tanstack/react-router";
import HelpStudioPage from "@/pages/ajuda/studio/HelpStudioPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { HelpStudioGuard } from "@/components/guards/HelpStudioGuard";

export const Route = createFileRoute("/_main/ajuda_/studio")({
  component: () => (
      <ProtectedRoute module="help_center">
        <HelpStudioGuard>
          <HelpStudioPage />
        </HelpStudioGuard>
      </ProtectedRoute>
  ),
});
