import { useEffect, useMemo, useState } from 'react';
import {
  Search, RotateCcw, X, SlidersHorizontal, ChevronDown, ChevronsUpDown, Check,
  ArrowDownUp, ArrowDown, ArrowUp, Layers, Users, UserCheck, UserX,
  ListFilter, Bot, User, CalendarClock, BarChart3, Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Collapsible, CollapsibleContent, CollapsibleTrigger, Popover, PopoverContent, PopoverTrigger,
  Checkbox, ScrollArea, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn,
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
  TeamMemberSelect, useTeamByClient,
} from '../extend/ui';
import { useAuth } from '../extend/auth';
import { useAgentQueueLimits } from '../extend/queues';
import type { JuliaChatFilters as Filters, JuliaSlaStatus } from '../api/types';
import type { OptionItem } from '../hooks/useJuliaChatOptions';

/** Badge de canal — mesmas cores/rotulagem do /chat. */
function channelBadge(type: string) {
  switch (type) {
    case 'uazapi': return <Badge variant="outline" className="border-emerald-300 px-1 text-[10px] text-emerald-600">WhatsApp</Badge>;
    case 'waba': return <Badge variant="outline" className="border-emerald-400 px-1 text-[10px] text-emerald-700">WABA</Badge>;
    case 'webchat': return <Badge variant="outline" className="border-blue-300 px-1 text-[10px] text-blue-600">WebChat</Badge>;
    case 'instagram': return <Badge variant="outline" className="border-pink-300 px-1 text-[10px] text-pink-600">Instagram</Badge>;
    default: return <Badge variant="outline" className="px-1 text-[10px]">{type}</Badge>;
  }
}

const ALL = '__all__';


const PERIOD_OPTIONS: { value: Filters['period']; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '3m', label: '3 meses' },
  { value: 'month', label: 'Mês atual' },
];

const SORT_OPTIONS: { value: Filters['sort']; label: string; icon: typeof ArrowDown }[] = [
  { value: 'recent', label: 'Mais recentes primeiro', icon: ArrowDown },
  { value: 'oldest', label: 'Mais antigas primeiro', icon: ArrowUp },
  { value: 'unread', label: 'Não lidas primeiro', icon: ListFilter },
  { value: 'sla', label: 'SLA mais crítico', icon: ArrowDownUp },
];

const SLA_OPTIONS: { value: JuliaSlaStatus; label: string; tone: string }[] = [
  { value: 'breached', label: 'SLA estourado', tone: 'text-destructive border-destructive/40' },
  { value: 'at_risk', label: 'SLA em risco', tone: 'text-amber-600 dark:text-amber-400 border-amber-500/40' },
  { value: 'on_track', label: 'SLA no prazo', tone: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40' },
];

const CHIP_BASE =
  'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background';

function Chip({
  active, onToggle, label, className, style,
}: {
  active: boolean; onToggle: () => void; label: string; className?: string; style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onToggle}
      style={style}
      className={cn(
        CHIP_BASE,
        active ? 'border-transparent bg-primary text-primary-foreground' : 'bg-background/60 text-foreground hover:bg-accent',
        className,
      )}
    >
      <span className="max-w-[150px] truncate">{label}</span>
      {active && <X className="h-3 w-3 shrink-0" aria-hidden />}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

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
          style={it.color && !selected.includes(it.id) ? { borderColor: it.color, color: it.color } : undefined}
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
  juliaStages: { id: string; name: string; color?: string | null }[];
  owners: string[];
  resultCount?: number;
  snoozedCount?: number;
  onOpenSnoozed?: () => void;
}

export function JuliaChatFiltersBar({
  filters, onChange, onReset, queues, tags, juliaStages, owners, resultCount,
  snoozedCount = 0, onOpenSnoozed,
}: Props) {
  const [open, setOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  // Busca só é aplicada no Enter (evita uma consulta por tecla digitada).
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '');
  useEffect(() => { setSearchDraft(filters.search ?? ''); }, [filters.search]);
  const { user, isAdmin } = useAuth();
  const { data: teamMembers = [] } = useTeamByClient();
  const navigate = useNavigate();
  // Mesmas regras do /chat: grupos só com o recurso liberado no plano; métricas
  // e configurações apenas para admin/titular/colaborador.
  const { data: queueLimits } = useAgentQueueLimits();
  const showGroupsTab = !!queueLimits?.allowGroups;
  const canManageChat = !!isAdmin || user?.role === 'user' || user?.role === 'colaborador';

  useEffect(() => {
    if (!showGroupsTab && filters.tab !== 'individual') onChange({ tab: 'individual' });
  }, [showGroupsTab, filters.tab, onChange]);

  const toggleIn = <K extends 'tag_ids' | 'queue_ids' | 'owners' | 'julia_stage_ids'>(field: K, id: string) => {
    const cur = filters[field] as string[];
    onChange({ [field]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } as Partial<Filters>);
  };

  const toggleSla = (v: JuliaSlaStatus) => {
    const cur = filters.sla_status;
    onChange({ sla_status: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };

  const allStagesSelected = juliaStages.length > 0 && filters.julia_stage_ids.length === juliaStages.length;
  const toggleAllStages = () => {
    onChange({ julia_stage_ids: allStagesSelected ? [] : juliaStages.map((s) => s.id) });
  };

  const queueLabel =
    filters.queue_ids.length === 0
      ? 'Todas as filas'
      : filters.queue_ids.length === 1
        ? queues.find((q) => q.id === filters.queue_ids[0])?.name ?? '1 fila'
        : `${filters.queue_ids.length} filas`;

  const stageLabel =
    filters.julia_stage_ids.length === 0 || allStagesSelected
      ? 'Todas as etapas'
      : filters.julia_stage_ids.length === 1
        ? juliaStages.find((s) => s.id === filters.julia_stage_ids[0])?.name ?? '1 etapa'
        : `${filters.julia_stage_ids.length} etapas`;

  const ownerValue = filters.unassigned ? 'unassigned' : filters.owners[0] ?? 'all';
  const setOwnerValue = (v: string) => {
    if (v === 'all') onChange({ owners: [], unassigned: null });
    else if (v === 'unassigned') onChange({ owners: [], unassigned: true });
    else if (v === 'mine') onChange({ owners: user?.name ? [String(user.name)] : [], unassigned: null });
    else onChange({ owners: [v], unassigned: null });
  };


  const mode: 'all' | 'julia' | 'human' = filters.julia_mode ?? 'all';

  /** Chips-resumo dos filtros ativos (exceto busca). */
  const activeChips = useMemo(() => {
    const out: { key: string; label: string; clear: () => void }[] = [];
    const push = (key: string, label: string, clear: () => void) => out.push({ key, label, clear });

    // status agora é controlado pelas abas acima da lista (igual /chat)

    if (filters.tab === 'groups') push('tab', 'Grupos', () => onChange({ tab: 'individual' }));
    if (filters.period !== 'all') {
      const periodLabel = PERIOD_OPTIONS.find((o) => o.value === filters.period)?.label ?? filters.period;
      push('period', `Período: ${periodLabel}`, () => onChange({ period: 'all' }));
    }
    if (filters.queue_ids.length > 0) {
      const qLabel = filters.queue_ids.length === 1
        ? queues.find((q) => q.id === filters.queue_ids[0])?.name ?? '1 fila'
        : `${filters.queue_ids.length} filas`;
      push('queues', `Fila: ${qLabel}`, () => onChange({ queue_ids: [] }));
    }
    if (filters.owners.length > 0) {
      push('owner', `Responsável: ${filters.owners[0]}`, () => onChange({ owners: [] }));
    } else if (filters.unassigned) {
      push('unassigned', 'Sem responsável', () => onChange({ unassigned: null }));
    }
    if (filters.julia_mode) {
      const modeLabel = filters.julia_mode === 'julia' ? 'Júlia IA' : 'Humano';
      push('mode', `Modo: ${modeLabel}`, () => onChange({ julia_mode: null }));
    }
    if (filters.priority) push('priority', `Prioridade: ${filters.priority}`, () => onChange({ priority: null }));
    if (filters.has_ticket) push('ticket', 'Com ticket', () => onChange({ has_ticket: null }));
    if (filters.has_crm_builder) push('crm', 'No CRM Builder', () => onChange({ has_crm_builder: null }));
    if (filters.has_campaign) push('ads', 'Meta Ads', () => onChange({ has_campaign: null }));
    filters.sla_status.forEach((s) =>
      push(`sla-${s}`, SLA_OPTIONS.find((o) => o.value === s)?.label ?? s, () => toggleSla(s)),
    );
    filters.tag_ids.forEach((id) =>
      push(`tag-${id}`, tags.find((t) => t.id === id)?.name ?? id, () => toggleIn('tag_ids', id)),
    );
    return out;
  }, [filters, tags, queues]);

  const dirty =
    activeChips.length > 0 ||
    filters.search.trim().length > 0 ||
    filters.period !== 'all' ||
    filters.sort !== 'recent' ||
    filters.queue_ids.length > 0 ||
    filters.julia_stage_ids.length > 0 ||
    filters.owners.length > 0 ||
    !!filters.julia_mode;

  const modeButtons: { value: 'all' | 'julia' | 'human'; icon: typeof Bot; tip: string; on: string }[] = [
    { value: 'all', icon: ListFilter, tip: 'Todos os modos', on: 'bg-primary text-primary-foreground border-primary' },
    { value: 'julia', icon: Bot, tip: 'Filas com Júlia IA ativa', on: 'bg-emerald-600 text-primary-foreground border-emerald-600' },
    { value: 'human', icon: User, tip: 'Atendimento humano (Júlia inativa)', on: 'bg-amber-600 text-primary-foreground border-amber-600' },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-1.5">
        {/* Linha 1 — busca + ações rápidas */}
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="julia-chat-search"
              aria-label="Buscar conversas (pressione Enter)"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onChange({ search: searchDraft.trim() });
                }
              }}
              placeholder="Buscar atendimento… (Enter)"
              className="h-9 pl-8 pr-8"
            />
            {(searchDraft || filters.search) && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Limpar busca"
                onClick={() => {
                  setSearchDraft('');
                  onChange({ search: '' });
                }}
                className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Ordenar conversas">
                    <ArrowDownUp className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Ordenar conversas</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-56 p-1">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onChange({ sort: o.value })}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted',
                    filters.sort === o.value && 'bg-muted font-medium',
                  )}
                >
                  <o.icon className="h-3.5 w-3.5" aria-hidden />
                  {o.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 shrink-0"
                aria-label="Agenda de retornos (conversas adiadas)"
                onClick={() => onOpenSnoozed?.()}
              >
                <CalendarClock className="h-4 w-4" />
                {snoozedCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-medium text-white">
                    {snoozedCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Agenda de retornos (conversas adiadas)</TooltipContent>
          </Tooltip>

          {showGroupsTab && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={filters.tab === 'groups' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label={filters.tab === 'groups' ? 'Ver individuais' : 'Ver grupos'}
                  onClick={() => onChange({ tab: filters.tab === 'groups' ? 'individual' : 'groups' })}
                >
                  <Users className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{filters.tab === 'groups' ? 'Ver individuais' : 'Ver grupos'}</TooltipContent>
            </Tooltip>
          )}

          {canManageChat && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="Métricas"
                    onClick={() => navigate('/chat/metricas')}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Métricas</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="Configurações do chat"
                    onClick={() => navigate('/chat/configuracoes')}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Configurações do chat</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Limpar filtros" onClick={onReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Limpar filtros</TooltipContent>
          </Tooltip>
        </div>

        {/* Filtros de período, fila, atendente e modo foram movidos para o painel "Mais filtros" */}

        {/* Demais filtros — colapsados */}
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="relative rounded-lg border bg-card/50">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-start gap-1.5 px-2 text-xs"
                aria-expanded={open}
                aria-controls="julia-chat-filters-panel"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                <span>Mais filtros</span>
                {activeChips.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{activeChips.length}</Badge>
                )}
                <ChevronDown className={cn('ml-auto h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
              </Button>
            </CollapsibleTrigger>

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

            <CollapsibleContent
              id="julia-chat-filters-panel"
              className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-popover shadow-xl"
            >
              <div className="thin-scrollbar max-h-[75vh] space-y-3 overflow-y-auto p-2.5">

                <div className="grid grid-cols-2 gap-2">
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
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Etapas do CRM da Júlia</Label>
                    <Popover open={stageOpen} onOpenChange={setStageOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="h-8 w-full justify-between bg-background text-xs font-normal">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="truncate">{stageLabel}</span>
                          </span>
                          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[280px] p-0">
                        <div className="border-b px-2 py-1.5">
                          <button
                            type="button"
                            onClick={toggleAllStages}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                          >
                            <Checkbox checked={allStagesSelected} className="pointer-events-none" />
                            <span className="font-medium">{allStagesSelected ? 'Desmarcar todas' : 'Selecionar todas'}</span>
                          </button>
                        </div>

                        <ScrollArea className="max-h-[260px]">
                          <div className="p-1">
                            {juliaStages.length === 0 ? (
                              <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma etapa disponível</p>
                            ) : (
                              juliaStages.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => toggleIn('julia_stage_ids', s.id)}
                                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                                >
                                  <Checkbox checked={filters.julia_stage_ids.includes(s.id)} className="pointer-events-none" />
                                  {s.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />}
                                  <span className="flex-1 truncate">{s.name}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Group label="Período">
                  {PERIOD_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      active={filters.period === opt.value}
                      onToggle={() => onChange({ period: opt.value })}
                    />
                  ))}
                </Group>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fila</Label>
                    <Popover open={queueOpen} onOpenChange={setQueueOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="h-8 w-full justify-between bg-background text-xs font-normal">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="truncate">{queueLabel}</span>
                          </span>
                          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[280px] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar fila…" className="h-9" />
                          <CommandList className="max-h-[280px]">
                            <CommandEmpty>Nenhuma fila encontrada.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__all__ todas as filas"
                                onSelect={() => { onChange({ queue_ids: [] }); setQueueOpen(false); }}
                                className="cursor-pointer gap-2"
                              >
                                <Check className={cn('h-4 w-4', filters.queue_ids.length === 0 ? 'opacity-100' : 'opacity-0')} />
                                <Layers className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                                <span className="flex-1 truncate">Todas as filas</span>
                              </CommandItem>
                              {[...queues]
                                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
                                .map((q) => {
                                  const isSel = filters.queue_ids.length === 1 && filters.queue_ids[0] === q.id;
                                  return (
                                    <CommandItem
                                      key={q.id}
                                      value={`${q.name} ${q.channel_type ?? ''}`}
                                      onSelect={() => { onChange({ queue_ids: [q.id] }); setQueueOpen(false); }}
                                      className="cursor-pointer gap-2"
                                    >
                                      <Check className={cn('h-4 w-4', isSel ? 'opacity-100' : 'opacity-0')} />
                                      <span className="flex-1 truncate">{q.name}</span>
                                      {q.channel_type ? channelBadge(q.channel_type) : null}
                                    </CommandItem>
                                  );
                                })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Atendente</Label>
                    <TeamMemberSelect
                      members={teamMembers}
                      valueKey="name"
                      value={ownerValue}
                      onValueChange={(v) => setOwnerValue(v ?? 'all')}
                      allowUnassigned={false}
                      extraOptions={[
                        { value: 'all', label: 'Todos Atendimentos', icon: Users },
                        { value: 'mine', label: 'Meus atendimentos', icon: UserCheck, badgeLabel: 'EU' },
                        { value: 'unassigned', label: 'Aguardando Atendimento', icon: UserX },
                      ]}
                      placeholder="Atendente"
                      size="sm"
                      className="w-full text-[11px]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Modo de atendimento</Label>
                  <div className="flex items-center gap-1" role="group" aria-label="Modo de atendimento">
                    {modeButtons.map((b) => (
                      <Tooltip key={b.value}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={b.tip}
                            aria-pressed={mode === b.value}
                            onClick={() => onChange({ julia_mode: b.value === 'all' ? null : b.value })}
                            className={cn(
                              'flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors',
                              mode === b.value ? b.on : 'border-border bg-transparent text-muted-foreground hover:bg-muted',
                            )}
                          >
                            <b.icon className="h-3.5 w-3.5" aria-hidden />
                            <span className="hidden sm:inline">{b.value === 'all' ? 'Todos' : b.value === 'julia' ? 'Júlia' : 'Humano'}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{b.tip}</TooltipContent>
                      </Tooltip>
                    ))}
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
    </TooltipProvider>
  );
}
