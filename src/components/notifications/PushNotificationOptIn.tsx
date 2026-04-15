import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isCurrentlySubscribed,
} from "@/lib/pushNotifications";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function PushNotificationOptIn() {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setPermission(getPushPermission());
    isCurrentlySubscribed().then(setSubscribed);
  }, []);

  if (!isPushSupported() || !user?.id) return null;

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        const ok = await unsubscribeFromPush(user.id);
        if (ok) {
          setSubscribed(false);
          toast.success("Notificações push desativadas");
        }
      } else {
        const ok = await subscribeToPush(user.id);
        if (ok) {
          setSubscribed(true);
          setPermission("granted");
          toast.success("Notificações push ativadas!");
        } else {
          const perm = getPushPermission();
          setPermission(perm);
          if (perm === "denied") {
            toast.error("Permissão negada. Habilite nas configurações do navegador.");
          } else {
            toast.error("Não foi possível ativar as notificações");
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const Icon = subscribed ? BellRing : permission === "denied" ? BellOff : Bell;
  const label = subscribed
    ? "Notificações ativas"
    : permission === "denied"
    ? "Notificações bloqueadas"
    : "Ativar notificações";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          disabled={loading || permission === "denied"}
          className="relative"
        >
          <Icon className={`h-5 w-5 ${subscribed ? "text-primary" : ""}`} />
          {subscribed && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
