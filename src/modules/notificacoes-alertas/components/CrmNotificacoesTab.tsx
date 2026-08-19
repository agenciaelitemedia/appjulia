import { useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  UnifiedFilters,
  type UnifiedFiltersState,
  CRMScrollNavigation,
  useCRMAgents,
} from '../extend/crm';
import { ALERT_TRIGGERS } from '../module';
import { useAlertCrmCards } from '../hooks/useAlertCrmCards';
import { AlertCrmLeadCard } from './AlertCrmLeadCard';
import { AlertCrmCardDetailsDialog } from './AlertCrmCardDetailsDialog';
import type { AlertCrmCard } from '../types';

const STAGE_COLORS = [
  '#f97316',
  '#22c55e',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#eab308',
];

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export function CrmNotificacoesTab() {
  const { data: agents = [], isLoading: agentsLoading } = useCRMAgents();
  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: daysAgo(30),
    dateTo: today(),
  });

  const { data: cards = [], isLoading } = useAlertCrmCards({
    agentCodes: filters.agentCodes,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  const [selected, setSelected] = useState<AlertCrmCard | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter((c) =>
      [c.lead_name, c.lead_phone, c.business_name, c.cod_agent]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [cards, filters.search]);

  const openCards = filtered.filter((c) => c.status === 'open');
  const recovered = filtered.filter((c) => c.status === 'recovered').length;
  const lost = filtered.filter((c) => c.status === 'lost').length;

  const handleCardClick = (card: AlertCrmCard) => {
    setSelected(card);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-4">
      <UnifiedFilters
        agents={agents as any}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading}
        searchPlaceholder="Buscar por nome, WhatsApp ou escritório..."
      />

      {/* Totalizadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {ALERT_TRIGGERS.map((trigger, idx) => {
          const count = openCards.filter((c) => c.trigger_key === trigger.key).length;
          return (
            <Card
              key={trigger.key}
              className="border-l-4"
              style={{ borderLeftColor: STAGE_COLORS[idx % STAGE_COLORS.length] }}
            >
              <CardContent className="p-3">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground line-clamp-1" title={trigger.label}>
                  {trigger.label}
                </p>
              </CardContent>
            </Card>
          );
        })}

        <Card className="border-l-4 border-l-green-500 bg-green-500/5">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-green-600">{recovered}</p>
            <p className="text-xs text-muted-foreground">Recuperados</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive bg-destructive/5">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-destructive">{lost}</p>
            <p className="text-xs text-muted-foreground">Perdidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline */}
      {isLoading ? (
        <div className="flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 min-w-[280px]" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          <div
            ref={scrollRef}
            className="flex gap-4 pb-16 overflow-x-auto scrollbar-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {ALERT_TRIGGERS.map((trigger, idx) => {
              const color = STAGE_COLORS[idx % STAGE_COLORS.length];
              const stageCards = openCards.filter((c) => c.trigger_key === trigger.key);
              return (
                <div
                  key={trigger.key}
                  className="flex flex-col min-w-[280px] max-w-[280px] bg-muted/30 rounded-lg"
                >
                  <div
                    className="p-3 rounded-t-lg flex items-center justify-between"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <h3 className="font-medium text-sm line-clamp-1" title={trigger.label}>
                        {trigger.label}
                      </h3>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {stageCards.length}
                    </Badge>
                  </div>

                  <div className="flex-1 p-2">
                    <div className="space-y-2">
                      {stageCards.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Nenhum lead neste alerta
                        </div>
                      ) : (
                        stageCards.map((card) => (
                          <AlertCrmLeadCard
                            key={card.id}
                            card={card}
                            onClick={() => handleCardClick(card)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <CRMScrollNavigation scrollRef={scrollRef} />
        </div>
      )}

      <AlertCrmCardDetailsDialog
        card={selected}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
