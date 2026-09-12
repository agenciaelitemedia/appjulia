import { createFileRoute } from "@tanstack/react-router";
import AdvboxNotificationRulesPage from "@/pages/advbox/NotificationRulesPage";

export const Route = createFileRoute("/_main/advbox_/regras")({
  component: AdvboxNotificationRulesPage,
});
