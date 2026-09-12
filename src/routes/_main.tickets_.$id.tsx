import { createFileRoute } from "@tanstack/react-router";
import TicketDetailPage from "@/pages/tickets/TicketDetailPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/tickets_/$id")({
  component: () => (
      <ProtectedRoute module="support_tickets">
        <TicketDetailPage />
      </ProtectedRoute>
  ),
});
