import { createFileRoute } from "@tanstack/react-router";
import DataJudSearchPage from "@/pages/datajud/DataJudSearchPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/datajud")({
  component: () => (
      <ProtectedRoute module="datajud">
        <DataJudSearchPage />
      </ProtectedRoute>
  ),
});
