import { createFileRoute } from "@tanstack/react-router";
import TelefoniaPage from "@/pages/telefonia/TelefoniaPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/telefonia")({
  component: () => (
      <ProtectedRoute module="telephony">
        <TelefoniaPage />
      </ProtectedRoute>
  ),
});
