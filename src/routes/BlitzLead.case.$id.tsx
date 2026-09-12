import { createFileRoute } from "@tanstack/react-router";
import CaseDetailPage from "@/blitzleads/pages/CaseDetailPage";

export const Route = createFileRoute("/BlitzLead/case/$id")({
  component: CaseDetailPage,
});
