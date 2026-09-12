import { createFileRoute } from "@tanstack/react-router";
import QuickMessagesPage from "@/pages/mensagens-rapidas/QuickMessagesPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/mensagens-rapidas")({
  component: () => (
      <ProtectedRoute module="quick_messages">
        <QuickMessagesPage />
      </ProtectedRoute>
  ),
});
