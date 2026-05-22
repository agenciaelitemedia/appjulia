import { useState, useEffect, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useChatClientSettings } from '@/hooks/useChatClientSettings';
import { CONVERSATION_EVENT_ACTIONS, getEventConfig } from '@/components/chat/ConversationEvent';
import type { ConversationHistoryEntry } from '@/types/conversation';
import { cn } from '@/lib/utils';

const SAMPLE_ACTOR = 'Fulano de Tal';

function EventBadgePreview({ action }: { action: string }) {
  const entry = {
    id: `preview-${action}`,
    conversation_id: 'preview',
    action,
    actor_name: SAMPLE_ACTOR,
    actor_id: null,
    from_value: null,
    to_value: null,
    metadata: null,
    created_at: new Date().toISOString(),
  } as unknown as ConversationHistoryEntry;
  const cfg = getEventConfig(entry);
  if (!cfg) {
    // Eventos sem render (ex.: 'opened' do sistema) — mostra um preview neutro
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] text-muted-foreground bg-muted/50 border-border">
        <span>{action}</span>
      </div>
    );
  }
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] ${cfg.color}`}>
      {cfg.icon}
      <span>{cfg.label}</span>
    </div>
  );
}

export function ConversationEventsSettingsCard() {
  const { settings, isLoading, update } = useChatClientSettings();

  const [enabled, setEnabled] = useState(true);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setEnabled(settings.events_enabled);
    setVisibility(settings.event_visibility ?? {});
  }, [settings]);

  const isDirty = useMemo(() => {
    if (enabled !== settings.events_enabled) return true;
    const a = visibility;
    const b = settings.event_visibility ?? {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if ((a[k] ?? true) !== (b[k] ?? true)) return true;
    }
    return false;
  }, [enabled, visibility, settings]);

  const isVisible = (action: string) => visibility[action] !== false;
  const setVisible = (action: string, v: boolean) =>
    setVisibility(prev => ({ ...prev, [action]: v }));

  const enableAll = () => {
    const next: Record<string, boolean> = {};
    CONVERSATION_EVENT_ACTIONS.forEach(e => { next[e.action] = true; });
    setVisibility(next);
  };
  const disableAll = () => {
    const next: Record<string, boolean> = {};
    CONVERSATION_EVENT_ACTIONS.forEach(e => { next[e.action] = false; });
    setVisibility(next);
  };

  const handleSave = () => {
    update.mutate({
      events_enabled: enabled,
      event_visibility: visibility,
    });
  };

  if (isLoading) return null;

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
      <div className={cn(
        'px-5 py-4 border-b flex items-start gap-3 transition-colors',
        enabled ? 'bg-blue-50/60 dark:bg-blue-950/20' : 'bg-muted/40',
      )}>
        <div className={cn(
          'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
          enabled ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-muted text-muted-foreground',
        )}>
          <Activity className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">Eventos da Conversa</h3>
            <Badge
              variant={enabled ? 'default' : 'secondary'}
              className={cn(
                'h-5 px-2 text-[10px] font-medium',
                enabled && 'bg-blue-500 hover:bg-blue-500 text-white border-transparent',
              )}
            >
              {enabled ? 'Visível' : 'Oculto'}
            </Badge>
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            Controla quais eventos do sistema (atribuições, etiquetas, prioridades, etc.) aparecem na timeline do chat.
            Os eventos continuam sendo registrados — apenas a exibição muda.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          className="mt-1"
        />
      </div>

      <div className={cn('transition-all', enabled ? 'opacity-100' : 'opacity-60 pointer-events-none')}>
        <div className="px-5 py-3 border-b bg-muted/10 flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            Eventos exibidos no chat
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={enableAll} disabled={!enabled}>
              Habilitar todos
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={disableAll} disabled={!enabled}>
              Desabilitar todos
            </Button>
          </div>
        </div>

        <div className="p-3 space-y-1.5">
          {CONVERSATION_EVENT_ACTIONS.map(({ action }) => (
            <div
              key={action}
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors"
            >
              <EventBadgePreview action={action} />
              <Switch
                checked={isVisible(action)}
                onCheckedChange={(v) => setVisible(action, v)}
                disabled={!enabled}
              />
            </div>
          ))}
        </div>
      </div>

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
        <Button size="sm" onClick={handleSave} disabled={update.isPending || !isDirty}>
          {update.isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  );
}