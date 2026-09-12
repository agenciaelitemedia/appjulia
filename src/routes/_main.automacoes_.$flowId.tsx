import { createFileRoute } from "@tanstack/react-router";
import FlowEditorPage from "@/modules/flow-builder/pages/FlowEditorPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/automacoes_/$flowId")({
  component: () => (
      <ProtectedRoute module="flow_builder">
        <FlowEditorPage />
      </ProtectedRoute>
  ),
});
