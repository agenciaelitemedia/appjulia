import { useState, useEffect, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Volume2, CheckCircle2, AlertCircle, Info, Users } from 'lucide-react';
import { useChatClientSettings } from '@/hooks/useChatClientSettings';
import { cn } from '@/lib/utils';

export function SoundAlertSettingsCard() {
  const { settings, isLoading, update } = useChatClientSettings();

  const [enabled, setEnabled] = useState(true);
  const [userCanDisable, setUserCanDisable] = useState(true);

  useEffect(() => {
    setEnabled(settings.sound_alert_enabled);
    setUserCanDisable(settings.sound_alert_user_can_disable);
  }, [settings]);

  const isDirty = useMemo(() => (
    enabled !== settings.sound_alert_enabled ||
    userCanDisable !== settings.sound_alert_user_can_disable
  ), [enabled, userCanDisable, settings]);

  const handleSave = () => {
    update.mutate({
      sound_alert_enabled: enabled,
      sound_alert_user_can_disable: userCanDisable,
    });
  };

  if (isLoading) return null;

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Header */}
      <div className={cn(
        "px-5 py-4 border-b flex items-start gap-3 transition-colors",
        enabled ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "bg-muted/40",
      )}>
        <div className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
          enabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
        )}>
          <Volume2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">Alertas</h3>
            <Badge
              variant={enabled ? 'default' : 'secondary'}
              className={cn(
                "h-5 px-2 text-[10px] font-medium",
                enabled && "bg-emerald-500 hover:bg-emerald-500 text-white border-transparent",
              )}
            >
              {enabled ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            Alerta de som para novas mensagens recebidas no Chat. Com o alerta ativo, todos os usuários do cliente ficam com o som habilitado.
          </p>
        </div>
        <Switch
          id="sound-alert-toggle"
          checked={enabled}
          onCheckedChange={setEnabled}
          className="mt-1"
        />
      </div>

      {/* Body */}
      <div className={cn("transition-all", enabled ? "opacity-100" : "opacity-60")}>
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 rounded-md border bg-background/50 px-4 py-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <Label htmlFor="sound-alert-user-can-disable" className="text-[13px] font-medium cursor-pointer">
                  Permitir que usuários da equipe desativem seu próprio alerta
                </Label>
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                  Quando permitido, cada usuário pode silenciar/reativar o som pelo ícone no topo do sistema.
                </p>
              </div>
            </div>
            <Switch
              id="sound-alert-user-can-disable"
              checked={userCanDisable}
              onCheckedChange={setUserCanDisable}
              disabled={!enabled}
            />
          </div>

          <div className={cn(
            "flex gap-2 rounded-md border px-3 py-2 text-[12px]",
            enabled
              ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40 text-blue-900 dark:text-blue-200"
              : "bg-muted/40 border-border text-muted-foreground",
          )}>
            {enabled ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />}
            <p className="leading-snug">
              {enabled
                ? <>O som toca em qualquer página da plataforma quando uma nova mensagem chega no Chat. O estado de cada usuário também pode ser gerenciado na página <strong>Equipe</strong>.</>
                : <>Com o alerta desativado, nenhum usuário do cliente ouvirá o som de novas mensagens.</>}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between gap-3">
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          {isDirty ? (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              <span>Alterações não salvas</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Tudo salvo</span>
            </>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={update.isPending || !isDirty}
        >
          {update.isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  );
}