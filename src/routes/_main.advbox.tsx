import { createFileRoute } from "@tanstack/react-router";
import AdvboxIntegrationPage from "@/pages/advbox/IntegrationPage";

export const Route = createFileRoute("/_main/advbox")({
  component: AdvboxIntegrationPage,
});
