import { createFileRoute } from "@tanstack/react-router";
import ChatTelephonyPage from "@/modules/julia-chat/pages/config/ChatTelephonyPage";

export const Route = createFileRoute("/_main/chat_/telefonia")({
  component: ChatTelephonyPage,
});
