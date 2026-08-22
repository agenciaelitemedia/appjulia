import { Search, RotateCcw, X } from 'lucide-react';
import {
  Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn,
} from '../extend/ui';
import type { MvpChatFilters as Filters, MvpSlaStatus } from '../api/types';
import { DEFAULT_MVP_FILTERS } from '../api/types';
import type { OptionItem } from '../hooks/useMvpChatOptions';

const ALL = '__all__';

const SLA_OPTIONS: { value: MvpSlaStatus; label: string; tone: string }[] = [
  { value: 'breached', label: 'SLA estourado', tone: 'bg-destructive/15 text-destructive' },
  { value: 'at_risk', label: 'SLA em risco', tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  { value: 'on_track', label: 'SLA no prazo', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
];

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  queues: OptionItem[];
  tags: OptionItem[];
  juliaStages: { id: string; name: string }[];
  owners: string[];
}

export function MvpChatFiltersBar({ filters, onChange, onReset, queues, tags, juliaStages, owners }: Props) {
  const toggleIn = <K extends 'tag_ids' | 'queue_ids' | 'owners' | 'julia_stage_ids'>(field: K, id: string) => {
    const cur = filters[field] as string[];
    onChange({ [field]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } as Partial<Filters>);
  };

  const toggleSla = (v: MvpSlaStatus) => {
    const cur = filters.sla_status;
    onChange({ sla_status: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };

  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_MVP_FILTERS);

  return (
    <div className="space-y-3 rounded-xl border bg-card/60 p-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Nome, telefone, protocolo…"
            className="h-9 pl-8"
          />
        </div>

        <Select value={filters.status ?? ALL} onValueChange={(v) => onChange({ status: v === ALL ? null : (v as Filters['status']) })}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            <SelectItem value="pending">Aguardando</SelectItem>
            <SelectItem value="open">Atendimento</SelectItem>
            <SelectItem value="resolved_closed">Resolvidos/Fechados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.period} onValueChange={(v) => onChange({ period: v as Filters['period'] })}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="month">Mês atual</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.tab ?? ALL} onValueChange={(v) => onChange({ tab: v === ALL ? null : (v as Filters['tab']) })}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="individual">Individuais</SelectItem>
            <SelectItem value="groups">Grupos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.priority ?? ALL} onValueChange={(v) => onChange({ priority: v === ALL ? null : v })}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Prioridade</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.julia_mode ?? ALL} onValueChange={(v) => onChange({ julia_mode: v === ALL ? null : (v as Filters['julia_mode']) })}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Modo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Modo (IA/Humano)</SelectItem>
            <SelectItem value="julia">Júlia ativa</SelectItem>
            <SelectItem value="human">Humano</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sort} onValueChange={(v) => onChange({ sort: v as Filters['sort'] })}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigas</SelectItem>
            <SelectItem value="unread">Não lidas primeiro</SelectItem>
            <SelectItem value="sla">SLA mais crítico</SelectItem>
          </SelectContent>
        </Select>

        {dirty && (
          <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant={filters.unassigned ? 'default' : 'outline'}
          className="h-6 cursor-pointer px-2 text-[11px]"
          onClick={() => onChange({ unassigned: filters.unassigned ? null : true })}
        >
          Sem responsável
        </Badge>
        <Badge
          variant={filters.has_ticket ? 'default' : 'outline'}
          className="h-6 cursor-pointer px-2 text-[11px]"
          onClick={() => onChange({ has_ticket: filters.has_ticket ? null : true })}
        >
          Com ticket
        </Badge>
        <Badge
          variant={filters.has_crm_builder ? 'default' : 'outline'}
          className="h-6 cursor-pointer px-2 text-[11px]"
          onClick={() => onChange({ has_crm_builder: filters.has_crm_builder ? null : true })}
        >
          No CRM Builder
        </Badge>
        <Badge
          variant={filters.has_campaign ? 'default' : 'outline'}
          className="h-6 cursor-pointer px-2 text-[11px]"
          onClick={() => onChange({ has_campaign: filters.has_campaign ? null : true })}
        >
          Meta Ads
        </Badge>

        <span className="mx-1 text-[11px] text-muted-foreground">SLA:</span>
        {SLA_OPTIONS.map((o) => (
          <Badge
            key={o.value}
            variant={filters.sla_status.includes(o.value) ? 'default' : 'outline'}
            className={cn('h-6 cursor-pointer px-2 text-[11px]', !filters.sla_status.includes(o.value) && o.tone)}
            onClick={() => toggleSla(o.value)}
          >
            {o.label}
          </Badge>
        ))}
      </div>

      {owners.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mx-1 text-[11px] text-muted-foreground">Responsáveis:</span>
          {owners.map((o) => (
            <Badge
              key={o}
              variant={filters.owners.includes(o) ? 'default' : 'outline'}
              className="h-6 cursor-pointer px-2 text-[11px]"
              onClick={() => toggleIn('owners', o)}
            >
              {o}
              {filters.owners.includes(o) && <X className="ml-1 h-3 w-3" />}
            </Badge>
          ))}
        </div>
      )}

      {juliaStages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mx-1 text-[11px] text-muted-foreground">Etapas CRM da Júlia:</span>
          {juliaStages.map((s) => (
            <Badge
              key={s.id}
              variant={filters.julia_stage_ids.includes(s.id) ? 'default' : 'outline'}
              className="h-6 cursor-pointer px-2 text-[11px]"
              onClick={() => toggleIn('julia_stage_ids', s.id)}
            >
              {s.name}
              {filters.julia_stage_ids.includes(s.id) && <X className="ml-1 h-3 w-3" />}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {queues.length > 0 && <span className="mx-1 text-[11px] text-muted-foreground">Filas:</span>}
        {queues.map((q) => (
          <Badge
            key={q.id}
            variant={filters.queue_ids.includes(q.id) ? 'default' : 'outline'}
            className="h-6 cursor-pointer px-2 text-[11px]"
            onClick={() => toggleIn('queue_ids', q.id)}
          >
            {q.name}
            {filters.queue_ids.includes(q.id) && <X className="ml-1 h-3 w-3" />}
          </Badge>
        ))}

        {tags.length > 0 && <span className="mx-1 text-[11px] text-muted-foreground">Etiquetas:</span>}
        {tags.map((t) => (
          <Badge
            key={t.id}
            variant="outline"
            className={cn('h-6 cursor-pointer px-2 text-[11px]', filters.tag_ids.includes(t.id) && 'ring-2 ring-ring')}
            style={{ borderColor: t.color ?? undefined, color: t.color ?? undefined }}
            onClick={() => toggleIn('tag_ids', t.id)}
          >
            {t.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
