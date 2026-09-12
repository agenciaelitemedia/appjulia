import { createFileRoute } from "@tanstack/react-router";
import HumanSupportPage from "@/pages/atendimento-humano/HumanSupportPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/atendimento-humano")({
  component: () => (
      <ProtectedRoute module="human_support">
        <HumanSupportPage />
      </ProtectedRoute>
  ),
});
