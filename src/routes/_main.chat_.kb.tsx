import { createFileRoute } from "@tanstack/react-router";
import ChatKnowledgeBasePage from "@/modules/julia-chat/pages/config/ChatKnowledgeBasePage";

export const Route = createFileRoute("/_main/chat_/kb")({
  component: ChatKnowledgeBasePage,
});
