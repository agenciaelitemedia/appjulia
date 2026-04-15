import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useEnsurePushNotificationsModule() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const ensureModule = async () => {
      const { data } = await supabase
        .from("modules")
        .select("id")
        .eq("code", "push_notifications")
        .maybeSingle();

      if (!data) {
        await supabase.from("modules").insert({
          code: "push_notifications",
          name: "Notificações Push",
          icon: "bell-ring",
          route: "/admin/notificacoes-push",
          group_name: "SISTEMA",
          is_active: true,
          position: 99,
        });
      }
    };

    ensureModule();
  }, [user]);
}
