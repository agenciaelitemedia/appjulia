import { createFileRoute } from "@tanstack/react-router";
import RedirectPage from "@/pages/RedirectPage";

export const Route = createFileRoute("/redirect")({
  component: RedirectPage,
});
