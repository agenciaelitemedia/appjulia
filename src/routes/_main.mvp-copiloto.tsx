import { createFileRoute } from "@tanstack/react-router";
import MvpCopilotoPage from "@/modules/mvp-copiloto/pages/MvpCopilotoPage";

export const Route = createFileRoute("/_main/mvp-copiloto")({
  component: MvpCopilotoPage,
});
