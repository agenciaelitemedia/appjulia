import { createFileRoute } from "@tanstack/react-router";
import AdvboxLogsPage from "@/pages/advbox/LogsPage";

export const Route = createFileRoute("/_main/advbox_/logs")({
  component: AdvboxLogsPage,
});
