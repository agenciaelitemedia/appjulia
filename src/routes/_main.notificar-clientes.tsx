import { createFileRoute } from "@tanstack/react-router";
import NotifyCustomersPage from "@/pages/notify-customers/NotifyCustomersPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/notificar-clientes")({
  component: () => (
      <ProtectedRoute module="notify_customers">
        <NotifyCustomersPage />
      </ProtectedRoute>
  ),
});
