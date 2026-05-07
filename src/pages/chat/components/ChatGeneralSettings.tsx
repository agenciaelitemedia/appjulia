import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatClientSettings } from '@/hooks/useChatClientSettings';
import { useChatSlaConfigs, DEFAULT_SLA_BY_PRIORITY } from '@/hooks/useChatSlaConfigs';

const PRIORITY_LABELS: Record<string, { label: string; dot: string }> = {
  urgent: { label: 'Crítica',  dot: 'bg-red-500' },
  high:   { label: 'Alta',     dot: 'bg-orange-500' },
  normal: { label: 'Média',    dot: 'bg-blue-500' },
  low:    { label: 'Baixa',    dot: 'bg-slate-400' },
};

const PRIORITY_ORDER = ['urgent', 'high', 'normal', 'low'];

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
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/40 px-4 py-3 border-b">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            Retornar Chat
          </h3>
        </div>

        <div className="p-4 space-y-4">
          {/* Toggle row */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="return-chat-toggle" className="font-medium">
                {enabled ? 'Retorno automático ativado' : 'Retorno automático desativado'}
              </Label>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {enabled
                  ? 'Conversas com SLA de Próximas Respostas (NRT) vencido terão o responsável removido e serão devolvidas à fila Em Aberto.'
                  : 'Quando ativado, conversas com SLA NRT vencido terão o responsável removido e serão devolvidas à fila Em Aberto.'}
              </p>
            </div>
            <Switch
              id="return-chat-toggle"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* Expanded content when enabled */}
          {enabled && (
            <div className="space-y-4 pt-2 border-t">
              {/* NRT times read-only */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-medium text-foreground/80">
                    Tempos de resposta (NRT) configurados:
                  </p>
                  <button
                    onClick={() => navigate('/chat/configuracoes?tab=sla')}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Editar em SLA
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_ORDER.map(p => {
                    const { label, dot } = PRIORITY_LABELS[p];
                    return (
                      <div key={p} className="flex items-center gap-2 text-[13px]">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
                        <span className="text-muted-foreground">{label}</span>
                        <span className="ml-auto font-mono font-medium">{formatMinutes(getNrtMinutes(p))}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tolerance input */}
              <div className="space-y-1.5">
                <Label htmlFor="tolerance-input" className="text-[13px] font-medium">
                  Tolerância adicional (minutos)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tolerance-input"
                    type="number"
                    min={0}
                    value={tolerance}
                    onChange={e => setTolerance(Number(e.target.value))}
                    className="w-28 text-center"
                  />
                  <p className="text-[12px] text-muted-foreground">
                    Aguarda mais {tolerance > 0 ? `${tolerance} min` : '0 min'} após o NRT vencer antes de devolver.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end pt-2 border-t">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={update.isPending}
            >
              {update.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
