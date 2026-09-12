import { createFileRoute } from "@tanstack/react-router";
import ChatInboxViewsPage from "@/modules/julia-chat/pages/config/ChatInboxViewsPage";

export const Route = createFileRoute("/_main/chat_/visoes")({
  component: ChatInboxViewsPage,
});
