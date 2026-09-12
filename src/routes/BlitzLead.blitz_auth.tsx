import { createFileRoute } from "@tanstack/react-router";
import BlitzAuthPage from "@/blitzleads/pages/BlitzAuthPage";

export const Route = createFileRoute("/BlitzLead/blitz_auth")({
  component: BlitzAuthPage,
});
