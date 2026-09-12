import { createFileRoute } from "@tanstack/react-router";
import BoardSettingsPage from "@/pages/crm-builder/BoardSettingsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/crm-builder_/$boardId_/configuracoes")({
  component: () => (
      <ProtectedRoute module="crm_painel">
        <BoardSettingsPage />
      </ProtectedRoute>
  ),
});
