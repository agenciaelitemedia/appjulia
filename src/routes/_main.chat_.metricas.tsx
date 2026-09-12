import { createFileRoute } from "@tanstack/react-router";
import ChatMetricsPage from "@/modules/julia-chat/pages/config/ChatMetricsPage";

export const Route = createFileRoute("/_main/chat_/metricas")({
  component: ChatMetricsPage,
});
