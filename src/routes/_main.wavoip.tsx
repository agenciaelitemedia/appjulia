import { createFileRoute } from "@tanstack/react-router";
import WavoipPage from "@/pages/wavoip/WavoipPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/wavoip")({
  component: () => (
      <ProtectedRoute module="wavoip">
        <WavoipPage />
      </ProtectedRoute>
  ),
});
