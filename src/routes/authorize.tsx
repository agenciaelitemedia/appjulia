import { createFileRoute } from "@tanstack/react-router";
import CopilotoAuthorizeRedirect from "@/pages/CopilotoAuthorizeRedirect";

export const Route = createFileRoute("/authorize")({
  component: CopilotoAuthorizeRedirect,
});
