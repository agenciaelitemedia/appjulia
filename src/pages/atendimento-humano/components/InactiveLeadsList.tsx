import { ReactNode, useMemo, useRef, useEffect, useState } from 'react';
import { Search, Loader2, Headset, UserCircle, Layers, ChevronsUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InactiveLeadItem } from './InactiveLeadItem';
import { StartConversationFooter } from './StartConversationFooter';
import { cn } from '@/lib/utils';
import type { InactiveSession } from '@/lib/externalDb';
import type { LeadPeriod } from '../hooks/useInactiveLeads';

const PERIOD_OPTIONS: { value: LeadPeriod; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7days', label: '7 dias' },
  { value: 'thisMonth', label: 'Mês atual' },
  { value: 'last3Months', label: '3 meses' },
];

interface TeamMember {
  id: number;
  name: string;
}

interface StageOption {
  id: number;
  name: string;
  color?: string;
}

interface InactiveLeadsListProps {
  leads: InactiveSession[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedLeadId: number | null;
  onSelectLead: (lead: InactiveSession) => void;
  totalCount: number;
  agentSelect?: ReactNode;
  selectedPeriod: LeadPeriod;
  onPeriodChange: (p: LeadPeriod) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  ownerFilter: string;
  onOwnerFilterChange: (f: string) => void;
  teamMembers: TeamMember[];
  codAgent: string | null;
  onStartConversation: (whatsappNumber: string) => void;
  stages: StageOption[];
  stageIds: number[];
  onStageIdsChange: (ids: number[]) => void;
}

export function InactiveLeadsList({
  leads,
  isLoading,
  searchQuery,
  onSearchChange,
  selectedLeadId,
  onSelectLead,
  totalCount,
  agentSelect,
  selectedPeriod,
  onPeriodChange,
  hasMore,
  onLoadMore,
  ownerFilter,
  onOwnerFilterChange,
  teamMembers,
  codAgent,
  onStartConversation,
  stages,
  stageIds,
  onStageIdsChange,
}: InactiveLeadsListProps) {
  const [stagePopoverOpen, setStagePopoverOpen] = useState(false);
  const stageSet = useMemo(() => new Set(stageIds), [stageIds]);
  const allStagesSelected = stages.length > 0 && stageIds.length === stages.length;
  const stageLabel = useMemo(() => {
    if (stageIds.length === 0 || allStagesSelected) return 'Todas as etapas';
    if (stageIds.length === 1) {
      const s = stages.find((x) => x.id === stageIds[0]);
      return s?.name ?? '1 etapa';
    }
    return `${stageIds.length} etapas`;
  }, [stageIds, stages, allStagesSelected]);

  const toggleStage = (id: number) => {
    if (stageSet.has(id)) onStageIdsChange(stageIds.filter((x) => x !== id));
    else onStageIdsChange([...stageIds, id]);
  };
  const toggleAllStages = () => {
    onStageIdsChange(allStagesSelected ? [] : stages.map((s) => s.id));
  };
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-3 pt-2 pb-2 border-b space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headset className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-sm">Atendimento Humano</h2>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {totalCount}
          </span>
        </div>
        {agentSelect && <div>{agentSelect}</div>}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onPeriodChange(opt.value)}
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer border",
                selectedPeriod === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-transparent hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={ownerFilter} onValueChange={onOwnerFilterChange}>
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos</SelectItem>
              <SelectItem value="mine" className="text-xs font-bold uppercase tracking-wide text-primary">
                MEUS CARDS
              </SelectItem>
              <SelectItem value="unassigned" className="text-xs text-muted-foreground italic">
                Sem Responsável
              </SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.name} className="text-xs">
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
          <Popover open={stagePopoverOpen} onOpenChange={setStagePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="h-8 w-full justify-between text-xs font-normal"
              >
                <span className="truncate">{stageLabel}</span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <div className="px-2 py-1.5 border-b">
                <button
                  onClick={toggleAllStages}
                  className="flex items-center gap-2 w-full text-xs hover:bg-accent rounded px-2 py-1.5"
                >
                  <Checkbox checked={allStagesSelected} className="pointer-events-none" />
                  <span className="font-medium">{allStagesSelected ? 'Desmarcar todas' : 'Selecionar todas'}</span>
                </button>
              </div>
              <ScrollArea className="max-h-[260px]">
                <div className="p-1">
                  {stages.length === 0 ? (
                    <div className="text-xs text-muted-foreground px-3 py-4 text-center">
                      Nenhuma etapa disponível
                    </div>
                  ) : (
                    stages.map((stage) => (
                      <button
                        key={stage.id}
                        onClick={() => toggleStage(stage.id)}
                        className="flex items-center gap-2 w-full text-xs hover:bg-accent rounded px-2 py-1.5 text-left"
                      >
                        <Checkbox checked={stageSet.has(stage.id)} className="pointer-events-none" />
                        {stage.color && (
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                        )}
                        <span className="truncate">{stage.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Headset className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'Nenhum lead encontrado' : 'Nenhum lead aguardando atendimento'}
            </p>
          </div>
        ) : (
          <div>
            {leads.map((lead) => (
              <InactiveLeadItem
                key={`${lead.id}-${lead.whatsapp_number}`}
                lead={lead}
                isSelected={selectedLeadId === lead.id}
                onSelect={onSelectLead}
              />
            ))}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <StartConversationFooter
        codAgent={codAgent}
        onConversationStarted={onStartConversation}
      />
    </div>
  );
}
