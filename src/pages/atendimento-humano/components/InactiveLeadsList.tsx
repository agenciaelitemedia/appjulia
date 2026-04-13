import { ReactNode } from 'react';
import { Search, Loader2, Headset } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InactiveLeadItem } from './InactiveLeadItem';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InactiveSession } from '@/lib/externalDb';
import type { LeadPeriod } from '../hooks/useInactiveLeads';

const PERIOD_OPTIONS: { value: LeadPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7days', label: '7 dias' },
  { value: 'thisMonth', label: 'Mês atual' },
  { value: 'last3Months', label: '3 meses' },
];

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
}: InactiveLeadsListProps) {
  return (
    <div className="flex flex-col h-full border-r bg-background">
      {/* Header */}
      <div className="p-3 border-b space-y-2">
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
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
