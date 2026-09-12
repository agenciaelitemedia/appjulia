import { createFileRoute } from "@tanstack/react-router";
import ChatMarketingAdvancedPage from "@/modules/julia-chat/pages/config/ChatMarketingAdvancedPage";

export const Route = createFileRoute("/_main/chat_/marketing")({
  component: ChatMarketingAdvancedPage,
});
