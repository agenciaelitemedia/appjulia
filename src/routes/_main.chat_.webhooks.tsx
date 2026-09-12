import { createFileRoute } from "@tanstack/react-router";
import ChatWebhooksPage from "@/modules/julia-chat/pages/config/ChatWebhooksPage";

export const Route = createFileRoute("/_main/chat_/webhooks")({
  component: ChatWebhooksPage,
});
