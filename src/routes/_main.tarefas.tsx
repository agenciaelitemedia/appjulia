import { createFileRoute } from "@tanstack/react-router";
import TasksPage from "@/pages/tarefas/TasksPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/tarefas")({
  component: () => (
      <ProtectedRoute module="tasks">
        <TasksPage />
      </ProtectedRoute>
  ),
});
