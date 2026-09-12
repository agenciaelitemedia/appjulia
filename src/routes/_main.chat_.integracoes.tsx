import { createFileRoute } from "@tanstack/react-router";
import ChatIntegrationsPage from "@/modules/julia-chat/pages/config/ChatIntegrationsPage";

export const Route = createFileRoute("/_main/chat_/integracoes")({
  component: ChatIntegrationsPage,
});
