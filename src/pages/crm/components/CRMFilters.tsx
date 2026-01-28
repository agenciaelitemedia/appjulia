import { useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';
import { CalendarIcon, Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { CRMAgent, CRMFiltersState } from '../types';
import { cn } from '@/lib/utils';
import { 
  QuickPeriod, 
  detectQuickPeriod, 
  calculatePeriodDates, 
  savePeriod 
} from '@/hooks/usePersistedPeriod';

interface CRMFiltersProps {
  agents: CRMAgent[];
  filters: CRMFiltersState;
  onFiltersChange: (filters: CRMFiltersState) => void;
  isLoading?: boolean;
}

const QUICK_PERIODS: { value: QuickPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7days', label: '7 Dias' },
  { value: 'thisMonth', label: 'Mês Atual' },
  { value: 'previousMonth', label: 'Mês Anterior' },
  { value: 'last3Months', label: '3 Meses' },
  { value: 'thisYear', label: 'Ano Atual' },
];

export function CRMFilters({ agents, filters, onFiltersChange, isLoading }: CRMFiltersProps) {
  const today = getTodayInSaoPaulo();

  const { selectedCount, allSelected, someSelected } = useMemo(() => {
    const selected = new Set(filters.agentCodes);
    const count = agents.reduce((acc, a) => acc + (selected.has(a.cod_agent) ? 1 : 0), 0);
    const all = agents.length > 0 && count === agents.length;
    return {
      selectedCount: count,
      allSelected: all,
      someSelected: count > 0 && !all,
    };
  }, [agents, filters.agentCodes]);

  const currentQuickPeriod = useMemo(() => {
    return detectQuickPeriod(filters.dateFrom, filters.dateTo);
  }, [filters.dateFrom, filters.dateTo]);

  // Save period to localStorage when it changes
  useEffect(() => {
    savePeriod(currentQuickPeriod);
  }, [currentQuickPeriod]);

  const handleQuickPeriod = (period: QuickPeriod) => {
    const { dateFrom, dateTo } = calculatePeriodDates(period);
    savePeriod(period);
    onFiltersChange({ ...filters, dateFrom, dateTo });
  };

  const handleAgentToggle = (codAgent: string) => {
    const newAgentCodes = filters.agentCodes.includes(codAgent)
      ? filters.agentCodes.filter((c) => c !== codAgent)
      : [...filters.agentCodes, codAgent];
    
    onFiltersChange({ ...filters, agentCodes: newAgentCodes });
  };

  const handleSelectAllAgents = () => {
    const allCodes = agents.map((a) => a.cod_agent);
    const allDisplayedSelected = agents.length > 0 && allCodes.every((c) => filters.agentCodes.includes(c));
    
    onFiltersChange({
      ...filters,
      agentCodes: allDisplayedSelected ? [] : allCodes,
    });
  };

  const handleDateFromChange = (date: Date | undefined) => {
    if (date) {
      onFiltersChange({ ...filters, dateFrom: format(date, 'yyyy-MM-dd') });
    }
  };

  const handleDateToChange = (date: Date | undefined) => {
    if (date) {
      onFiltersChange({ ...filters, dateTo: format(date, 'yyyy-MM-dd') });
    }
  };

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      agentCodes: agents.map((a) => a.cod_agent),
      dateFrom: today,
      dateTo: today,
    });
  };

  const dateFromObj = filters.dateFrom ? parseISO(filters.dateFrom) : undefined;
  const dateToObj = filters.dateTo ? parseISO(filters.dateTo) : undefined;

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filtros:</span>
      </div>

      {/* Quick Period Buttons */}
      <div className="flex gap-1">
        {QUICK_PERIODS.map((period) => (
          <Button
            key={period.value}
            variant={currentQuickPeriod === period.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickPeriod(period.value)}
          >
            {period.label}
          </Button>
        ))}
        {currentQuickPeriod === 'custom' && (
          <Badge variant="secondary" className="h-8 px-3 flex items-center">
            Personalizado
          </Badge>
        )}
      </div>

      {/* Date From */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">De</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'w-[130px] justify-start text-left font-normal',
                !filters.dateFrom && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom
                ? format(dateFromObj ?? new Date(), 'dd/MM/yyyy', { locale: ptBR })
                : 'Selecione'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFromObj}
              onSelect={handleDateFromChange}
              locale={ptBR}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Date To */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Até</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'w-[130px] justify-start text-left font-normal',
                !filters.dateTo && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo
                ? format(dateToObj ?? new Date(), 'dd/MM/yyyy', { locale: ptBR })
                : 'Selecione'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateToObj}
              onSelect={handleDateToChange}
              locale={ptBR}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Agent Select */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Agentes</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-[180px] justify-start text-left font-normal"
              disabled={isLoading}
            >
              {allSelected ? (
                'Todos os agentes'
              ) : selectedCount > 0 ? (
                `${selectedCount} selecionado${selectedCount > 1 ? 's' : ''}`
              ) : (
                'Selecionar agentes'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <div className="p-2 border-b">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={handleSelectAllAgents}
                  onClick={(e) => e.stopPropagation()}
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Selecionar Todos
                </label>
              </div>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-2 space-y-1">
                {agents.map((agent) => (
                  <div
                    key={agent.cod_agent}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                    onClick={() => handleAgentToggle(agent.cod_agent)}
                  >
                    <Checkbox
                      checked={filters.agentCodes.includes(agent.cod_agent)}
                      onCheckedChange={() => handleAgentToggle(agent.cod_agent)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        [{agent.cod_agent}] - {agent.owner_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {agent.owner_business_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
        <Label className="text-xs text-muted-foreground">Busca</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nome, WhatsApp, ID..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Clear Button */}
      <Button variant="ghost" size="sm" onClick={handleClearFilters}>
        <X className="h-4 w-4 mr-1" />
        Limpar
      </Button>
    </div>
  );
}
