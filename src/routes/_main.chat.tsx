import { createFileRoute } from "@tanstack/react-router";
import JuliaChatPage from "@/modules/julia-chat/pages/JuliaChatPage";

export const Route = createFileRoute("/_main/chat")({
  component: JuliaChatPage,
});
