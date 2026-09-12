import { createFileRoute } from "@tanstack/react-router";
import BoardPage from "@/pages/crm-builder/BoardPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/crm-builder_/$boardId")({
  component: () => (
      <ProtectedRoute module="crm_painel">
        <BoardPage />
      </ProtectedRoute>
  ),
});
