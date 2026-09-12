import { createFileRoute } from "@tanstack/react-router";
import ChatComplianceCenterPage from "@/modules/julia-chat/pages/config/ChatComplianceCenterPage";

export const Route = createFileRoute("/_main/chat_/compliance")({
  component: ChatComplianceCenterPage,
});
