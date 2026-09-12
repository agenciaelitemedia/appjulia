import { createFileRoute } from "@tanstack/react-router";
import ChatApiKeysPage from "@/modules/julia-chat/pages/config/ChatApiKeysPage";

export const Route = createFileRoute("/_main/chat_/api-keys")({
  component: ChatApiKeysPage,
});
