import { createFileRoute } from "@tanstack/react-router";
import ChatBotBuilderPage from "@/modules/julia-chat/pages/config/ChatBotBuilderPage";

export const Route = createFileRoute("/_main/chat_/builder")({
  component: ChatBotBuilderPage,
});
