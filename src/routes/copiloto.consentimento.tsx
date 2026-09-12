import { createFileRoute } from "@tanstack/react-router";
import CopilotoConsentPage from "@/pages/CopilotoConsentPage";

export const Route = createFileRoute("/copiloto/consentimento")({
  component: CopilotoConsentPage,
});
