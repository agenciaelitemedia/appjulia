import { createFileRoute } from "@tanstack/react-router";
import ChatBotsPage from "@/modules/julia-chat/pages/config/ChatBotsPage";

export const Route = createFileRoute("/_main/chat_/bots")({
  component: ChatBotsPage,
});
