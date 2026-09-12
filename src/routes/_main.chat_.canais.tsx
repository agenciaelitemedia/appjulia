import { createFileRoute } from "@tanstack/react-router";
import ChatChannelsPage from "@/modules/julia-chat/pages/config/ChatChannelsPage";

export const Route = createFileRoute("/_main/chat_/canais")({
  component: ChatChannelsPage,
});
