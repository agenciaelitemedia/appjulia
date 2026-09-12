import { createFileRoute } from "@tanstack/react-router";
import FlowListPage from "@/modules/flow-builder/pages/FlowListPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/automacoes")({
  component: () => (
      <ProtectedRoute module="flow_builder">
        <FlowListPage />
      </ProtectedRoute>
  ),
});
