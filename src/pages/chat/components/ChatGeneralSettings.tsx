import { useState, useEffect, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, RotateCcw, Info, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatClientSettings } from '@/hooks/useChatClientSettings';
import { useChatSlaConfigs, DEFAULT_SLA_BY_PRIORITY } from '@/hooks/useChatSlaConfigs';
import { cn } from '@/lib/utils';
import { BulkCloseConversationsCard } from './BulkCloseConversationsCard';

const PRIORITY_LABELS: Record<string, { label: string; dot: string }> = {
  urgent: { label: 'Crítica',  dot: 'bg-red-500' },
  high:   { label: 'Alta',     dot: 'bg-orange-500' },
  normal: { label: 'Média',    dot: 'bg-blue-500' },
  low:    { label: 'Baixa',    dot: 'bg-slate-400' },
};

const PRIORITY_ORDER = ['urgent', 'high', 'normal', 'low'];

const TOLERANCE_PRESETS = [0, 5, 15, 30, 60];

export function ChatGeneralSettings() {
  const navigate = useNavigate();
  const { settings, isLoading, update } = useChatClientSettings();
  const { configs } = useChatSlaConfigs();

  const [enabled, setEnabled] = useState(false);
  const [tolerance, setTolerance] = useState(0);

  useEffect(() => {
    setEnabled(settings.return_chat_enabled);
    setTolerance(settings.return_chat_tolerance_minutes);
  }, [settings]);

  const isDirty = useMemo(() => (
    enabled !== settings.return_chat_enabled ||
    tolerance !== settings.return_chat_tolerance_minutes
  ), [enabled, tolerance, settings]);

  const handleSave = () => {
    update.mutate({
      return_chat_enabled: enabled,
      return_chat_tolerance_minutes: Math.max(0, tolerance),
    });
  };

  const getNrtMinutes = (priority: string): number => {
    const cfg = configs.find(c => c.priority === priority && c.is_active);
    return cfg?.nrt_response_minutes ?? DEFAULT_SLA_BY_PRIORITY[priority]?.nrt ?? 60;
  };

  const formatMinutes = (mins: number): string => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  };

  if (isLoading) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Retornar Chat block */}
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
            <RotateCcw className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">Retornar Chat automaticamente</h3>
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
              Devolve à fila <span className="font-medium text-foreground/80">Em Aberto</span> conversas em que o responsável não respondeu dentro do SLA NRT.
            </p>
          </div>
          <Switch
            id="return-chat-toggle"
            checked={enabled}
            onCheckedChange={setEnabled}
            className="mt-1"
          />
        </div>

        {/* Body */}
        <div className={cn("transition-all", enabled ? "opacity-100" : "opacity-60")}>
          <div className="p-5 space-y-5">
            {/* NRT grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[12px] font-medium text-foreground/80 uppercase tracking-wide">
                    Tempos NRT por prioridade
                  </p>
                </div>
                <button
                  onClick={() => navigate('/chat/configuracoes?tab=sla')}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                >
                  Editar em SLA
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITY_ORDER.map(p => {
                  const { label, dot } = PRIORITY_LABELS[p];
                  const nrt = getNrtMinutes(p);
                  const total = nrt + Math.max(0, tolerance);
                  return (
                    <div
                      key={p}
                      className="flex items-center gap-2 px-3 py-2 rounded-md border bg-background/50 text-[13px]"
                    >
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
                      <span className="text-muted-foreground">{label}</span>
                      <div className="ml-auto flex items-baseline gap-1.5">
                        <span className="font-mono font-semibold tabular-nums">{formatMinutes(nrt)}</span>
                        {enabled && tolerance > 0 && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                            → {formatMinutes(total)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tolerance */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tolerance-input" className="text-[12px] font-medium uppercase tracking-wide text-foreground/80">
                  Tolerância adicional
                </Label>
                {tolerance > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    +{formatMinutes(tolerance)} após o NRT
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {TOLERANCE_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTolerance(preset)}
                    disabled={!enabled}
                    className={cn(
                      "h-8 px-3 rounded-md border text-[12px] font-medium transition-colors",
                      tolerance === preset
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-input",
                      !enabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    {preset === 0 ? 'Sem tolerância' : formatMinutes(preset)}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                  <Input
                    id="tolerance-input"
                    type="number"
                    min={0}
                    max={1440}
                    disabled={!enabled}
                    value={tolerance}
                    onChange={e => setTolerance(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 h-8 text-center text-[13px]"
                  />
                  <span className="text-[11px] text-muted-foreground">min</span>
                </div>
              </div>
            </div>

            {/* Info callout */}
            <div className={cn(
              "flex gap-2 rounded-md border px-3 py-2 text-[12px]",
              enabled
                ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40 text-blue-900 dark:text-blue-200"
                : "bg-muted/40 border-border text-muted-foreground",
            )}>
              {enabled ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              <p className="leading-snug">
                {enabled
                  ? <>O responsável será removido e a conversa ganhará uma nota interna explicando o retorno automático. A verificação roda a cada minuto.</>
                  : <>Ative para começar a devolver conversas inativas à fila <strong>Em Aberto</strong> automaticamente.</>}
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

      <BulkCloseConversationsCard />
    </div>
  );
}
