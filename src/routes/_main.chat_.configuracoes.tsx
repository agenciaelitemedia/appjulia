import { createFileRoute } from "@tanstack/react-router";
import ChatSettingsPage from "@/modules/julia-chat/pages/config/ChatSettingsPage";

export const Route = createFileRoute("/_main/chat_/configuracoes")({
  component: ChatSettingsPage,
});
