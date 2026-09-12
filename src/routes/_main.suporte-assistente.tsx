import { createFileRoute } from "@tanstack/react-router";
import SupportAssistantPage from "@/pages/suporte-assistente/SupportAssistantPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/suporte-assistente")({
  component: () => (
      <ProtectedRoute module="support_assistant">
        <SupportAssistantPage />
      </ProtectedRoute>
  ),
});
