import { createFileRoute } from "@tanstack/react-router";
import PushNotificationsPage from "@/pages/admin/push-notifications/PushNotificationsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/notificacoes-push")({
  component: () => (
      <ProtectedRoute module="push_notifications">
        <PushNotificationsPage />
      </ProtectedRoute>
  ),
});
