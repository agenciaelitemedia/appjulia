import { createFileRoute } from "@tanstack/react-router";
import DisparosPage from "@/modules/disparos/pages/DisparosPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/disparos")({
  component: () => (
      <ProtectedRoute module={"campaigns_dispatch" as any}>
        <DisparosPage />
      </ProtectedRoute>
  ),
});
