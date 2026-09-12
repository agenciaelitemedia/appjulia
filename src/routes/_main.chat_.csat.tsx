import { createFileRoute } from "@tanstack/react-router";
import ChatCsatPage from "@/modules/julia-chat/pages/config/ChatCsatPage";

export const Route = createFileRoute("/_main/chat_/csat")({
  component: ChatCsatPage,
});
