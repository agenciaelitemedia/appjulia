import { createFileRoute } from "@tanstack/react-router";
import PainelMigracaoPage from "@/pages/admin/migracao/PainelMigracaoPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/painel-migracao")({
  component: () => (
      <ProtectedRoute>
        <PainelMigracaoPage />
      </ProtectedRoute>
  ),
});
