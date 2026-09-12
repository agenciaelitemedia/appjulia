import { createFileRoute } from "@tanstack/react-router";
import ChatAutomationsPage from "@/modules/julia-chat/pages/config/ChatAutomationsPage";

export const Route = createFileRoute("/_main/chat_/automacoes")({
  component: ChatAutomationsPage,
});
