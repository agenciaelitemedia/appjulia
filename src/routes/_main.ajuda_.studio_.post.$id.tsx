import { createFileRoute } from "@tanstack/react-router";
import HelpPostEditorPage from "@/pages/ajuda/studio/HelpPostEditorPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { HelpStudioGuard } from "@/components/guards/HelpStudioGuard";

export const Route = createFileRoute("/_main/ajuda_/studio_/post/$id")({
  component: () => (
      <ProtectedRoute module="help_center">
        <HelpStudioGuard>
          <HelpPostEditorPage />
        </HelpStudioGuard>
      </ProtectedRoute>
  ),
});
