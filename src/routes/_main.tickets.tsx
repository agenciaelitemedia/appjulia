import { createFileRoute } from "@tanstack/react-router";
import TicketsPage from "@/pages/tickets/TicketsPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/tickets")({
  component: () => (
      <ProtectedRoute module="support_tickets">
        <TicketsPage />
      </ProtectedRoute>
  ),
});
