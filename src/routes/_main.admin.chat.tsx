import { createFileRoute } from "@tanstack/react-router";
import ChatAdminPage from "@/pages/admin/chat/ChatAdminPage";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";

export const Route = createFileRoute("/_main/admin/chat")({
  component: () => (
      <ProtectedRoute module="chat_admin">
        <ChatAdminPage />
      </ProtectedRoute>
  ),
});
