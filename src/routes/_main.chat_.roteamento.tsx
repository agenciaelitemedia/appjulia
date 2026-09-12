import { createFileRoute } from "@tanstack/react-router";
import ChatRoutingPage from "@/modules/julia-chat/pages/config/ChatRoutingPage";

export const Route = createFileRoute("/_main/chat_/roteamento")({
  component: ChatRoutingPage,
});
