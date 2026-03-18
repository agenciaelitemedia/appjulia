import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { InsightDetailCard } from './InsightDetailCard';
import type { InsightFilters } from '../hooks/useCopilotAdmin';

interface Props {
  insights: any[];
  totalInsights: number;
  isLoading: boolean;
  filters: InsightFilters;
  setFilters: (f: InsightFilters) => void;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  agents: string[];
}

export function InsightsMonitorTab({
  insights, totalInsights, isLoading, filters, setFilters, page, setPage, pageSize, agents
}: Props) {
  const totalPages = Math.ceil(totalInsights / pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          placeholder="Data início"
        />
        <Input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          placeholder="Data fim"
        />
        <Select
          value={filters.codAgent || 'all'}
          onValueChange={(v) => setFilters({ ...filters, codAgent: v === 'all' ? undefined : v })}
        >
          <SelectTrigger><SelectValue placeholder="Agente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Agentes</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.insightType || 'all'}
          onValueChange={(v) => setFilters({ ...filters, insightType: v === 'all' ? undefined : v })}
        >
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            <SelectItem value="stuck_lead">Lead Parado</SelectItem>
            <SelectItem value="hot_opportunity">Oportunidade Quente</SelectItem>
            <SelectItem value="risk">Risco</SelectItem>
            <SelectItem value="follow_up_needed">Follow-up</SelectItem>
            <SelectItem value="summary">Resumo</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.severity || 'all'}
          onValueChange={(v) => setFilters({ ...filters, severity: v === 'all' ? undefined : v })}
        >
          <SelectTrigger><SelectValue placeholder="Severidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="warning">Aviso</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhum insight encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight: any) => (
            <InsightDetailCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {totalInsights} insight(s) • Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
