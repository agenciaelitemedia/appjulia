import { createFileRoute } from "@tanstack/react-router";
import ChatAIAutoreplyPage from "@/modules/julia-chat/pages/config/ChatAIAutoreplyPage";

export const Route = createFileRoute("/_main/chat_/ia-autoresposta")({
  component: ChatAIAutoreplyPage,
});
