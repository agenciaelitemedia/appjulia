import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Timer, Info, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  useChatSlaConfigs,
  DEFAULT_SLA_BY_PRIORITY,
  type ChatSlaConfig,
} from '@/hooks/useChatSlaConfigs';
import { useState, useEffect } from 'react';

const PRIORITIES: { value: 'urgent' | 'high' | 'normal' | 'low'; label: string; color: string; dot: string }[] = [
  { value: 'urgent', label: 'Crítica',  color: 'text-destructive',        dot: 'bg-red-500' },
  { value: 'high',   label: 'Alta',     color: 'text-orange-500',         dot: 'bg-orange-400' },
  { value: 'normal', label: 'Média',    color: 'text-blue-500',           dot: 'bg-blue-500' },
  { value: 'low',    label: 'Baixa',    color: 'text-muted-foreground',   dot: 'bg-slate-400' },
];

const COLUMN_HELP = {
  first: 'Tempo máximo para o atendente enviar a primeira resposta após a conversa ser aberta.',
  nrt:   'Tempo máximo para o atendente responder após cada nova mensagem recebida do cliente (NRT — Next Response Time).',
  resolution: 'Tempo máximo para encerrar/resolver a conversa desde a abertura (TTR — Time to Resolution).',
};

interface RowState {
  first: number;
  nrt: number;
  resolution: number;
  active: boolean;
}

export function ChatSlaConfigContent({ showIntro = true }: { showIntro?: boolean }) {
  const { configs, isLoading, upsert } = useChatSlaConfigs();
  const [state, setState] = useState<Record<string, RowState>>({});

  useEffect(() => {
    const next: Record<string, RowState> = {};
    PRIORITIES.forEach((p) => {
      const existing = configs.find((c: ChatSlaConfig) => c.priority === p.value);
      next[p.value] = {
        first:      existing?.first_response_minutes ?? DEFAULT_SLA_BY_PRIORITY[p.value].first,
        nrt:        existing?.nrt_response_minutes   ?? DEFAULT_SLA_BY_PRIORITY[p.value].nrt,
        resolution: existing?.resolution_minutes     ?? DEFAULT_SLA_BY_PRIORITY[p.value].resolution,
        active:     existing?.is_active ?? true,
      };
    });
    setState(next);
  }, [configs]);

  const update = (priority: string, patch: Partial<RowState>) => {
    setState((s) => ({ ...s, [priority]: { ...s[priority], ...patch } }));
  };

  const save = (priority: string) => {
    const r = state[priority];
    upsert.mutate({
      priority: priority as 'urgent' | 'high' | 'normal' | 'low',
      first_response_minutes: Number(r.first) || 0,
      nrt_response_minutes:   Number(r.nrt)   || 0,
      resolution_minutes:     Number(r.resolution) || 0,
      is_active: r.active,
    });
  };

  function ColHeader({ label, helpKey }: { label: string; helpKey: keyof typeof COLUMN_HELP }) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 cursor-default select-none">
              {label}
              <HelpCircle className="h-3 w-3 text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px] text-xs">
            {COLUMN_HELP[helpKey]}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-4">
      {showIntro && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4 flex gap-3 items-start">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-foreground">Como funciona</p>
              <p className="text-muted-foreground">
                O SLA é avaliado em três etapas:
                <strong> 1ª Resposta (FRT)</strong> — aguardando a primeira resposta do atendente;
                <strong> Próx. Resposta (NRT)</strong> — atendente deve responder à última mensagem do cliente;
                <strong> Resolução (TTR)</strong> — atendente já respondeu, aguardando encerramento.
                As conversas exibem badges visuais conforme o SLA ativo.
              </p>
              <p className="text-muted-foreground text-xs">
                Os tempos seguem horas de trabalho (seg–sex, 9h–18h). Para SLA 24×7, ajuste os valores ou crie uma política específica para plantão.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          PRIORITIES.map((p) => {
            const r = state[p.value];
            if (!r) return null;
            return (
              <Card key={p.value}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-base ${p.color} flex items-center justify-between`}>
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${p.dot}`} />
                      {p.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.active}
                        onCheckedChange={(v) => update(p.value, { active: v })}
                      />
                      <Label className="text-xs text-muted-foreground">Ativo</Label>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <ColHeader label="1ª Resposta (FRT)" helpKey="first" />
                      <span className="text-muted-foreground">(min)</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={r.first}
                      onChange={(e) => update(p.value, { first: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <ColHeader label="Próx. Respostas (NRT)" helpKey="nrt" />
                      <span className="text-muted-foreground">(min)</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={r.nrt}
                      onChange={(e) => update(p.value, { nrt: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <ColHeader label="Resolução (TTR)" helpKey="resolution" />
                      <span className="text-muted-foreground">(min)</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={r.resolution}
                      onChange={(e) => update(p.value, { resolution: Number(e.target.value) })}
                    />
                  </div>
                  <Button onClick={() => save(p.value)} disabled={upsert.isPending}>
                    Salvar
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ChatSlaConfigPage() {
  const navigate = useNavigate();
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" /> Configuração de SLA
          </h2>
          <p className="text-muted-foreground text-sm">
            Defina metas de primeira resposta, próximas respostas e resolução por prioridade
          </p>
        </div>
      </div>

      <ChatSlaConfigContent />
    </div>
  );
}
