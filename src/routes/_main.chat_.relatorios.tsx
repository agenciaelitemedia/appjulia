import { createFileRoute } from "@tanstack/react-router";
import ChatReportsPage from "@/modules/julia-chat/pages/config/ChatReportsPage";

export const Route = createFileRoute("/_main/chat_/relatorios")({
  component: ChatReportsPage,
});
