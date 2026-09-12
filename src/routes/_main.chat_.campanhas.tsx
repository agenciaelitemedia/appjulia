import { createFileRoute } from "@tanstack/react-router";
import ChatCampaignsPage from "@/modules/julia-chat/pages/config/ChatCampaignsPage";

export const Route = createFileRoute("/_main/chat_/campanhas")({
  component: ChatCampaignsPage,
});
