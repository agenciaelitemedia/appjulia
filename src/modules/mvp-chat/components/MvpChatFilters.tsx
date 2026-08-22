import { useMemo, useState } from 'react';
import { Search, RotateCcw, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import {
  Badge, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Collapsible, CollapsibleContent, CollapsibleTrigger, cn,
} from '../extend/ui';
import type { MvpChatFilters as Filters, MvpSlaStatus } from '../api/types';
import { DEFAULT_MVP_FILTERS } from '../api/types';
import type { OptionItem } from '../hooks/useMvpChatOptions';

const ALL = '__all__';

const SLA_OPTIONS: { value: MvpSlaStatus; label: string; tone: string }[] = [
  { value: 'breached', label: 'SLA estourado', tone: 'text-destructive border-destructive/40' },
  { value: 'at_risk', label: 'SLA em risco', tone: 'text-amber-600 dark:text-amber-400 border-amber-500/40' },
  { value: 'on_track', label: 'SLA no prazo', tone: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40' },
];

const CHIP_BASE =
  'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background';

interface ChipProps {
  active: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
  style?: React.CSSProperties;
}

function Chip({ active, onToggle, label, className, style }: ChipProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onToggle}
      style={style}
      className={cn(
        CHIP_BASE,
        active
          ? 'border-transparent bg-primary text-primary-foreground'
          : 'bg-background/60 text-foreground hover:bg-accent',
        className,
      )}
    >
      <span className="max-w-[150px] truncate">{label}</span>
      {active && <X className="h-3 w-3 shrink-0" aria-hidden />}
    </button>
  );
}

interface GroupProps {
  label: string;
  children: React.ReactNode;
}

function Group({ label, children }: GroupProps) {
  return (
    <div role="group" aria-label={label} className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Lista de chips com limite e "ver mais". */
function ChipList({
  label, items, selected, onToggle, limit = 8,
}: {
  label: string;
  items: { id: string; name: string; color?: string | null }[];
  selected: string[];
  onToggle: (id: string) => void;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, limit);
  return (
    <Group label={label}>
      {visible.map((it) => (
        <Chip
          key={it.id}
          label={it.name}
          active={selected.includes(it.id)}
          onToggle={() => onToggle(it.id)}
          style={
            it.color && !selected.includes(it.id)
              ? { borderColor: it.color, color: it.color }
              : undefined
          }
        />
      ))}
      {items.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(CHIP_BASE, 'border-dashed bg-background/60 text-muted-foreground hover:bg-accent')}
        >
          {expanded ? 'ver menos' : `+${items.length - limit} ver mais`}
        </button>
      )}
    </Group>
  );
}

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  queues: OptionItem[];
  tags: OptionItem[];
  juliaStages: { id: string; name: string }[];
  owners: string[];
  /** Total de resultados, anunciado via aria-live. */
  resultCount?: number;
}

export function MvpChatFiltersBar({
  filters, onChange, onReset, queues, tags, juliaStages, owners, resultCount,
}: Props) {
  const [open, setOpen] = useState(false);

  const toggleIn = <K extends 'tag_ids' | 'queue_ids' | 'owners' | 'julia_stage_ids'>(field: K, id: string) => {
    const cur = filters[field] as string[];
    onChange({ [field]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } as Partial<Filters>);
  };

  const toggleSla = (v: MvpSlaStatus) => {
    const cur = filters.sla_status;
    onChange({ sla_status: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };

  /** Chips-resumo dos filtros ativos (exceto busca). */
  const activeChips = useMemo(() => {
    const out: { key: string; label: string; clear: () => void }[] = [];
    const push = (key: string, label: string, clear: () => void) => out.push({ key, label, clear });

    if (filters.status) {
      const map: Record<string, string> = { pending: 'Aguardando', open: 'Atendimento', resolved_closed: 'Resolvidos/Fechados' };
      push('status', map[filters.status] ?? filters.status, () => onChange({ status: null }));
    }
    if (filters.period !== 'all') {
      const map: Record<string, string> = { today: 'Hoje', '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', month: 'Mês atual' };
      push('period', map[filters.period] ?? filters.period, () => onChange({ period: 'all' }));
    }
    if (filters.tab) push('tab', filters.tab === 'groups' ? 'Grupos' : 'Individuais', () => onChange({ tab: null }));
    if (filters.priority) push('priority', `Prioridade: ${filters.priority}`, () => onChange({ priority: null }));
    if (filters.julia_mode) push('mode', filters.julia_mode === 'julia' ? 'Júlia ativa' : 'Humano', () => onChange({ julia_mode: null }));
    if (filters.sort !== 'recent') {
      const map: Record<string, string> = { oldest: 'Mais antigas', unread: 'Não lidas primeiro', sla: 'SLA mais crítico' };
      push('sort', map[filters.sort] ?? filters.sort, () => onChange({ sort: 'recent' }));
    }
    if (filters.unassigned) push('unassigned', 'Sem responsável', () => onChange({ unassigned: null }));
    if (filters.has_ticket) push('ticket', 'Com ticket', () => onChange({ has_ticket: null }));
    if (filters.has_crm_builder) push('crm', 'No CRM Builder', () => onChange({ has_crm_builder: null }));
    if (filters.has_campaign) push('ads', 'Meta Ads', () => onChange({ has_campaign: null }));
    filters.sla_status.forEach((s) =>
      push(`sla-${s}`, SLA_OPTIONS.find((o) => o.value === s)?.label ?? s, () => toggleSla(s)),
    );
    filters.owners.forEach((o) => push(`owner-${o}`, o, () => toggleIn('owners', o)));
    filters.julia_stage_ids.forEach((id) =>
      push(`stage-${id}`, juliaStages.find((s) => s.id === id)?.name ?? id, () => toggleIn('julia_stage_ids', id)),
    );
    filters.queue_ids.forEach((id) =>
      push(`queue-${id}`, queues.find((q) => q.id === id)?.name ?? id, () => toggleIn('queue_ids', id)),
    );
    filters.tag_ids.forEach((id) =>
      push(`tag-${id}`, tags.find((t) => t.id === id)?.name ?? id, () => toggleIn('tag_ids', id)),
    );
    return out;
  }, [filters, queues, tags, juliaStages]);

  const dirty = activeChips.length > 0 || filters.search.trim().length > 0;

  return (
    <div className="space-y-2">
      {/* Busca — sempre visível */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="mvp-chat-search"
          aria-label="Buscar conversas"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Nome, telefone, protocolo…"
          className="h-9 pl-8 pr-8"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Limpar busca"
            onClick={() => onChange({ search: '' })}
            className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="rounded-lg border bg-card/50">
          <div className="flex items-center gap-1 px-2 py-1.5">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 flex-1 justify-start gap-1.5 px-1.5 text-xs"
                aria-expanded={open}
                aria-controls="mvp-chat-filters-panel"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                <span>Filtros</span>
                {activeChips.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{activeChips.length}</Badge>
                )}
                <ChevronDown className={cn('ml-auto h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
              </Button>
            </CollapsibleTrigger>
            {dirty && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onReset}>
                <RotateCcw className="h-3 w-3" aria-hidden /> Limpar
              </Button>
            )}
          </div>

          {/* Resumo dos filtros ativos — visível mesmo com o card fechado */}
          {!open && activeChips.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t px-2 py-1.5">
              {activeChips.slice(0, 6).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-label={`Remover filtro ${c.label}`}
                  onClick={c.clear}
                  className={cn(CHIP_BASE, 'border-transparent bg-primary/15 text-primary hover:bg-primary/25')}
                >
                  <span className="max-w-[120px] truncate">{c.label}</span>
                  <X className="h-3 w-3 shrink-0" aria-hidden />
                </button>
              ))}
              {activeChips.length > 6 && (
                <span className="text-[10px] text-muted-foreground">+{activeChips.length - 6}</span>
              )}
            </div>
          )}

          <CollapsibleContent id="mvp-chat-filters-panel">
            <div className="thin-scrollbar max-h-[46vh] space-y-3 overflow-y-auto border-t p-2.5">
              {/* Situação */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="f-status" className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</Label>
                  <Select value={filters.status ?? ALL} onValueChange={(v) => onChange({ status: v === ALL ? null : (v as Filters['status']) })}>
                    <SelectTrigger id="f-status" className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos</SelectItem>
                      <SelectItem value="pending">Aguardando</SelectItem>
                      <SelectItem value="open">Atendimento</SelectItem>
                      <SelectItem value="resolved_closed">Resolvidos/Fechados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="f-tab" className="text-[10px] uppercase tracking-wide text-muted-foreground">Tipo</Label>
                  <Select value={filters.tab ?? ALL} onValueChange={(v) => onChange({ tab: v === ALL ? null : (v as Filters['tab']) })}>
                    <SelectTrigger id="f-tab" className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos</SelectItem>
                      <SelectItem value="individual">Individuais</SelectItem>
                      <SelectItem value="groups">Grupos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="f-priority" className="text-[10px] uppercase tracking-wide text-muted-foreground">Prioridade</Label>
                  <Select value={filters.priority ?? ALL} onValueChange={(v) => onChange({ priority: v === ALL ? null : v })}>
                    <SelectTrigger id="f-priority" className="h-8 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todas</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="f-mode" className="text-[10px] uppercase tracking-wide text-muted-foreground">Modo</Label>
                  <Select value={filters.julia_mode ?? ALL} onValueChange={(v) => onChange({ julia_mode: v === ALL ? null : (v as Filters['julia_mode']) })}>
                    <SelectTrigger id="f-mode" className="h-8 text-xs"><SelectValue placeholder="Modo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>IA e Humano</SelectItem>
                      <SelectItem value="julia">Júlia ativa</SelectItem>
                      <SelectItem value="human">Humano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="f-period" className="text-[10px] uppercase tracking-wide text-muted-foreground">Período</Label>
                  <Select value={filters.period} onValueChange={(v) => onChange({ period: v as Filters['period'] })}>
                    <SelectTrigger id="f-period" className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo período</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="month">Mês atual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="f-sort" className="text-[10px] uppercase tracking-wide text-muted-foreground">Ordenar</Label>
                  <Select value={filters.sort} onValueChange={(v) => onChange({ sort: v as Filters['sort'] })}>
                    <SelectTrigger id="f-sort" className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Mais recentes</SelectItem>
                      <SelectItem value="oldest">Mais antigas</SelectItem>
                      <SelectItem value="unread">Não lidas primeiro</SelectItem>
                      <SelectItem value="sla">SLA mais crítico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Group label="Marcadores">
                <Chip label="Sem responsável" active={!!filters.unassigned} onToggle={() => onChange({ unassigned: filters.unassigned ? null : true })} />
                <Chip label="Com ticket" active={!!filters.has_ticket} onToggle={() => onChange({ has_ticket: filters.has_ticket ? null : true })} />
                <Chip label="No CRM Builder" active={!!filters.has_crm_builder} onToggle={() => onChange({ has_crm_builder: filters.has_crm_builder ? null : true })} />
                <Chip label="Meta Ads" active={!!filters.has_campaign} onToggle={() => onChange({ has_campaign: filters.has_campaign ? null : true })} />
              </Group>

              <Group label="SLA">
                {SLA_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    label={o.label}
                    active={filters.sla_status.includes(o.value)}
                    onToggle={() => toggleSla(o.value)}
                    className={!filters.sla_status.includes(o.value) ? o.tone : undefined}
                  />
                ))}
              </Group>

              <ChipList
                label="Responsáveis"
                items={owners.map((o) => ({ id: o, name: o }))}
                selected={filters.owners}
                onToggle={(id) => toggleIn('owners', id)}
              />

              <ChipList
                label="Etapas CRM da Júlia"
                items={juliaStages}
                selected={filters.julia_stage_ids}
                onToggle={(id) => toggleIn('julia_stage_ids', id)}
              />

              <ChipList
                label="Filas"
                items={queues.map((q) => ({ id: q.id, name: q.name }))}
                selected={filters.queue_ids}
                onToggle={(id) => toggleIn('queue_ids', id)}
              />

              <ChipList
                label="Etiquetas"
                items={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
                selected={filters.tag_ids}
                onToggle={(id) => toggleIn('tag_ids', id)}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <p aria-live="polite" className="sr-only">
        {resultCount != null ? `${resultCount} conversas encontradas` : ''}
      </p>
    </div>
  );
}
