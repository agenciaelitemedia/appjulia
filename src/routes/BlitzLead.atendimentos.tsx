import { createFileRoute } from "@tanstack/react-router";
import CallCenterPage from "@/blitzleads/pages/CallCenterPage";

export const Route = createFileRoute("/BlitzLead/atendimentos")({
  component: CallCenterPage,
});
