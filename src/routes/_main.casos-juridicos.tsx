import { createFileRoute } from "@tanstack/react-router";
import LegalCasesPage from "@/pages/legal-cases/LegalCasesPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/casos-juridicos")({
  component: () => (
      <ProtectedRoute module="legal_cases">
        <LegalCasesPage />
      </ProtectedRoute>
  ),
});
