import { createFileRoute } from "@tanstack/react-router";
import ConfiguracoesPage from "@/pages/configuracoes/ConfiguracoesPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/configuracoes")({
  component: () => (
      <ProtectedRoute module="configuracoes">
        <ConfiguracoesPage />
      </ProtectedRoute>
  ),
});
