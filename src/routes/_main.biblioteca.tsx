import { createFileRoute } from "@tanstack/react-router";
import CriativosPage from "@/pages/criativos/CriativosPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/biblioteca")({
  component: () => (
      <ProtectedRoute module="library">
        <CriativosPage />
      </ProtectedRoute>
  ),
});
