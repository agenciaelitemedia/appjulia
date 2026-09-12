import { createFileRoute } from "@tanstack/react-router";
import PromptGeneratorPage from "@/pages/admin/prompts/PromptGeneratorPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/prompts")({
  component: () => (
      <ProtectedRoute module="prompt_generator">
        <PromptGeneratorPage />
      </ProtectedRoute>
  ),
});
