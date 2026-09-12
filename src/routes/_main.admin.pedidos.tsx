import { createFileRoute } from "@tanstack/react-router";
import PedidosPage from "@/pages/admin/pedidos/PedidosPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/pedidos")({
  component: () => (
      <ProtectedRoute module="julia_orders">
        <PedidosPage />
      </ProtectedRoute>
  ),
});
