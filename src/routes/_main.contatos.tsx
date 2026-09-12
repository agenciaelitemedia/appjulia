import { createFileRoute } from "@tanstack/react-router";
import ContatosPage from "@/pages/contatos/ContatosPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/contatos")({
  component: () => (
      <ProtectedRoute module="contacts">
        <ContatosPage />
      </ProtectedRoute>
  ),
});
