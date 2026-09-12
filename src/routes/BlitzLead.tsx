import { createFileRoute } from "@tanstack/react-router";
import BlitzLayout from "@/blitzleads/components/BlitzLayout";

export const Route = createFileRoute("/BlitzLead")({
  component: BlitzLayout,
});
