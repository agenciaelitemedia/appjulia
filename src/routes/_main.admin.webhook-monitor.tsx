import { createFileRoute } from "@tanstack/react-router";
import WebhookMonitorPage from "@/pages/admin/webhook-monitor/WebhookMonitorPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/webhook-monitor")({
  component: () => (
      <ProtectedRoute module="admin_agents">
        <WebhookMonitorPage />
      </ProtectedRoute>
  ),
});
