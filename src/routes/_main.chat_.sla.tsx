import { createFileRoute } from "@tanstack/react-router";
import ChatSlaConfigPage from "@/modules/julia-chat/pages/config/ChatSlaConfigPage";

export const Route = createFileRoute("/_main/chat_/sla")({
  component: ChatSlaConfigPage,
});
