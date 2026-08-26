import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Search } from 'lucide-react';
import { useDspQueues } from '../extend/queues';
import {
  useDspAgentCodes,
  useDspBoards,
  useDspCampaignOptions,
  useDspJuliaStages,
  useDspPipelines,
  useDspTags,
  type Option,
} from '../hooks/useDspAudienceOptions';
import type { DspAudienceFilterSpec } from '../types';

interface MultiProps {
  label: string;
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  hint?: string;
  loading?: boolean;
}

function OptionMultiSelect({ label, options, value, onChange, hint, loading }: MultiProps) {
  const [term, setTerm] = useState('');
  const filtered = useMemo(
    () => options.filter((o) => o.name.toLowerCase().includes(term.toLowerCase())),
    [options, term],
  );

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange([])}>
            limpar ({value.length})
          </Button>
        )}
      </div>
      {options.length > 8 && (
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar..." className="h-8 pl-7 text-xs" />
        </div>
      )}
      <ScrollArea className="h-32 rounded-md border p-2">
        {loading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!loading && filtered.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma opção</p>}
        <div className="space-y-1.5">
          {filtered.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={value.includes(o.id)} onCheckedChange={() => toggle(o.id)} />
              <span className="truncate">{o.name}</span>
              {o.extra && <Badge variant="outline" className="ml-auto text-[10px]">{o.extra}</Badge>}
            </label>
          ))}
        </div>
      </ScrollArea>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface Props {
  clientId: string | null;
  filters: DspAudienceFilterSpec;
  onChange: (f: DspAudienceFilterSpec) => void;
  onValidate: () => void;
  validating?: boolean;
  total?: number | null;
}

export function AudienceFilterBuilder({ clientId, filters, onChange, onValidate, validating, total }: Props) {
  const queues = useDspQueues(clientId);
  const tags = useDspTags(clientId);
  const boards = useDspBoards(clientId);
  const pipelines = useDspPipelines(clientId, filters.builder_board_ids ?? []);
  const campaigns = useDspCampaignOptions(clientId);
  const agents = useDspAgentCodes(clientId);
  const juliaStages = useDspJuliaStages();

  const set = (patch: Partial<DspAudienceFilterSpec>) => onChange({ ...filters, ...patch });
  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v) || 0));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <OptionMultiSelect
          label="Filas (canais)"
          options={(queues.data ?? []).map((q) => ({ id: q.id, name: q.name, extra: q.channel_type }))}
          value={filters.queue_ids ?? []}
          onChange={(v) => set({ queue_ids: v })}
          loading={queues.isLoading}
        />
        <OptionMultiSelect
          label="Tags da conversa"
          options={tags.data ?? []}
          value={filters.tag_ids ?? []}
          onChange={(v) => set({ tag_ids: v })}
          loading={tags.isLoading}
        />
        <OptionMultiSelect
          label="Agentes (cod_agent)"
          options={agents.data ?? []}
          value={filters.cod_agents ?? []}
          onChange={(v) => set({ cod_agents: v })}
          hint="Necessário para filtros de CRM da Julia, contratos e follow-up."
          loading={agents.isLoading}
        />
        <OptionMultiSelect
          label="Etapas do CRM da Julia"
          options={juliaStages.data ?? []}
          value={(filters.crm_julia_stage_ids ?? []).map(String)}
          onChange={(v) => set({ crm_julia_stage_ids: v.map((x) => Number(x)) })}
          loading={juliaStages.isLoading}
        />
        <OptionMultiSelect
          label="Painéis do CRM Builder"
          options={boards.data ?? []}
          value={filters.builder_board_ids ?? []}
          onChange={(v) => set({ builder_board_ids: v, builder_pipeline_ids: [] })}
          loading={boards.isLoading}
        />
        <OptionMultiSelect
          label="Etapas do CRM Builder"
          options={pipelines.data ?? []}
          value={filters.builder_pipeline_ids ?? []}
          onChange={(v) => set({ builder_pipeline_ids: v })}
          loading={pipelines.isLoading}
        />
        <OptionMultiSelect
          label="Campanhas anteriores"
          options={campaigns.data ?? []}
          value={filters.campaign_ids ?? []}
          onChange={(v) => set({ campaign_ids: v })}
          loading={campaigns.isLoading}
        />
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Resultado na campanha</Label>
            <Select
              value={filters.campaign_result ?? 'any'}
              onValueChange={(v) => set({ campaign_result: v === 'any' ? null : (v as any) })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="sent">Recebeu a mensagem</SelectItem>
                <SelectItem value="replied">Respondeu</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Canal do contato</Label>
            <Select
              value={filters.channel_type ?? 'any'}
              onValueChange={(v) => set({ channel_type: v === 'any' ? null : v })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Todos</SelectItem>
                <SelectItem value="uazapi">WhatsApp (não oficial)</SelectItem>
                <SelectItem value="waba">WhatsApp Oficial</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="webchat">WebChat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Interagiu nos últimos (dias)</Label>
          <Input
            type="number"
            min={0}
            className="h-8 text-xs"
            value={filters.last_interaction_days ?? ''}
            onChange={(e) => set({ last_interaction_days: num(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sem responder há (dias)</Label>
          <Input
            type="number"
            min={0}
            className="h-8 text-xs"
            value={filters.no_reply_days ?? ''}
            onChange={(e) => set({ no_reply_days: num(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Limite de contatos</Label>
          <Input
            type="number"
            min={0}
            className="h-8 text-xs"
            placeholder="sem limite"
            value={filters.limit ?? ''}
            onChange={(e) => set({ limit: num(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={!!filters.only_with_conversation}
            onCheckedChange={(v) => set({ only_with_conversation: v })}
          />
          Apenas com conversa aberta no chat
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={!!filters.in_followup} onCheckedChange={(v) => set({ in_followup: v })} />
          Em follow-up ativo
        </label>
        <div className="space-y-1.5">
          <Label className="text-xs">Contratos</Label>
          <Select
            value={filters.contract_status?.length ? filters.contract_status.join(',') : 'any'}
            onValueChange={(v) => set({ contract_status: v === 'any' ? [] : v.split(',') })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Ignorar</SelectItem>
              <SelectItem value="CREATED">Em curso (aguardando assinatura)</SelectItem>
              <SelectItem value="SIGNED">Assinados</SelectItem>
              <SelectItem value="CREATED,SIGNED">Em curso + assinados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
        <Button onClick={onValidate} disabled={validating} size="sm">
          {validating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Validar filtros
        </Button>
        {typeof total === 'number' && (
          <p className="text-sm">
            <span className="font-semibold text-foreground">{total.toLocaleString('pt-BR')}</span>{' '}
            <span className="text-muted-foreground">contato(s) válido(s) neste público</span>
          </p>
        )}
        {total === null && (
          <p className="text-xs text-muted-foreground">Os filtros são combinados com E (todos precisam bater).</p>
        )}
      </div>
    </div>
  );
}
