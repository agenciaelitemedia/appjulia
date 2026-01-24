import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CalendarIcon, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  X,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getTodayInSaoPaulo,
  getYesterdayInSaoPaulo,
  get7DaysAgoInSaoPaulo,
  get30DaysAgoInSaoPaulo,
  get3MonthsAgoInSaoPaulo,
  getLastWeekStartInSaoPaulo,
  getLastWeekEndInSaoPaulo,
  getFirstDayOfMonthInSaoPaulo,
  getLastDayOfMonthInSaoPaulo,
} from '@/lib/dateUtils';
import { UnifiedFiltersProps } from './types';

type QuickPeriod = 'today' | 'yesterday' | 'last7days' | 'lastWeek' | 'last30days' | 'last3Months' | 'thisMonth' | 'custom';

const QUICK_PERIODS: { value: QuickPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7days', label: '7 dias' },
  { value: 'lastWeek', label: 'Semana' },
  { value: 'last30days', label: '30 dias' },
  { value: 'last3Months', label: '3 meses' },
  { value: 'thisMonth', label: 'Mês' },
];

const STATUS_LABELS: Record<string, string> = {
  'CREATED': 'Criado',
  'SIGNED': 'Assinado',
  'PENDING': 'Pendente',
  'CANCELLED': 'Cancelado',
};

export function UnifiedFilters({
  agents,
  filters,
  onFiltersChange,
  isLoading = false,
  showAgentSelector = true,
  showSearch = true,
  showQuickPeriods = true,
  showPerfilFilter = false,
  showStatusFilter = false,
  statusOptions = [],
  showStateFilter = false,
  stateOptions = [],
  searchPlaceholder = 'Buscar...',
  className,
}: UnifiedFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Calcular contagem de agentes selecionados
  const selectedCount = useMemo(() => filters.agentCodes.length, [filters.agentCodes]);
  const allSelected = useMemo(() => 
    agents.length > 0 && filters.agentCodes.length === agents.length,
    [agents.length, filters.agentCodes.length]
  );
  const someSelected = useMemo(() => 
    filters.agentCodes.length > 0 && filters.agentCodes.length < agents.length,
    [agents.length, filters.agentCodes.length]
  );

  // Determinar período rápido atual
  const currentQuickPeriod = useMemo<QuickPeriod>(() => {
    const today = getTodayInSaoPaulo();
    const yesterday = getYesterdayInSaoPaulo();
    const last7days = get7DaysAgoInSaoPaulo();
    const last30days = get30DaysAgoInSaoPaulo();
    const last3Months = get3MonthsAgoInSaoPaulo();
    const lastWeekStart = getLastWeekStartInSaoPaulo();
    const lastWeekEnd = getLastWeekEndInSaoPaulo();
    const thisMonthStart = getFirstDayOfMonthInSaoPaulo();
    const thisMonthEnd = getLastDayOfMonthInSaoPaulo();

    if (filters.dateFrom === today && filters.dateTo === today) return 'today';
    if (filters.dateFrom === yesterday && filters.dateTo === yesterday) return 'yesterday';
    if (filters.dateFrom === last7days && filters.dateTo === today) return 'last7days';
    if (filters.dateFrom === lastWeekStart && filters.dateTo === lastWeekEnd) return 'lastWeek';
    if (filters.dateFrom === last30days && filters.dateTo === today) return 'last30days';
    if (filters.dateFrom === last3Months && filters.dateTo === today) return 'last3Months';
    if (filters.dateFrom === thisMonthStart && filters.dateTo === thisMonthEnd) return 'thisMonth';
    return 'custom';
  }, [filters.dateFrom, filters.dateTo]);

  // Handlers
  const handleQuickPeriod = (period: QuickPeriod) => {
    const today = getTodayInSaoPaulo();
    let dateFrom = today;
    let dateTo = today;

    switch (period) {
      case 'today':
        dateFrom = today;
        dateTo = today;
        break;
      case 'yesterday':
        dateFrom = getYesterdayInSaoPaulo();
        dateTo = getYesterdayInSaoPaulo();
        break;
      case 'last7days':
        dateFrom = get7DaysAgoInSaoPaulo();
        dateTo = today;
        break;
      case 'lastWeek':
        dateFrom = getLastWeekStartInSaoPaulo();
        dateTo = getLastWeekEndInSaoPaulo();
        break;
      case 'last30days':
        dateFrom = get30DaysAgoInSaoPaulo();
        dateTo = today;
        break;
      case 'last3Months':
        dateFrom = get3MonthsAgoInSaoPaulo();
        dateTo = today;
        break;
      case 'thisMonth':
        dateFrom = getFirstDayOfMonthInSaoPaulo();
        dateTo = getLastDayOfMonthInSaoPaulo();
        break;
    }

    onFiltersChange({ ...filters, dateFrom, dateTo });
  };

  const handleAgentToggle = (codAgent: string) => {
    const newAgentCodes = filters.agentCodes.includes(codAgent)
      ? filters.agentCodes.filter((c) => c !== codAgent)
      : [...filters.agentCodes, codAgent];
    onFiltersChange({ ...filters, agentCodes: newAgentCodes });
  };

  const handleSelectAllAgents = () => {
    if (allSelected) {
      onFiltersChange({ ...filters, agentCodes: [] });
    } else {
      onFiltersChange({ ...filters, agentCodes: agents.map((a) => a.cod_agent) });
    }
  };

  const handleDateFromChange = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, 'yyyy-MM-dd');
      onFiltersChange({ ...filters, dateFrom: formatted });
    }
  };

  const handleDateToChange = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, 'yyyy-MM-dd');
      onFiltersChange({ ...filters, dateTo: formatted });
    }
  };

  const handleClearFilters = () => {
    const today = getTodayInSaoPaulo();
    onFiltersChange({
      search: '',
      agentCodes: agents.map((a) => a.cod_agent),
      dateFrom: today,
      dateTo: today,
      perfilAgent: 'ALL',
      statusDocument: undefined,
      stateFilter: 'all',
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 p-0 hover:bg-transparent">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="font-medium">Filtros</span>
          </Button>
        </CollapsibleTrigger>
        {showAgentSelector && selectedCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {selectedCount} {selectedCount === 1 ? 'agente' : 'agentes'}
          </Badge>
        )}
      </div>

      <CollapsibleContent className="space-y-4">
        {/* Quick Period Buttons */}
        {showQuickPeriods && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Período:</span>
            {QUICK_PERIODS.map((period) => (
              <Button
                key={period.value}
                variant={currentQuickPeriod === period.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickPeriod(period.value)}
                disabled={isLoading}
              >
                {period.label}
              </Button>
            ))}
            {currentQuickPeriod === 'custom' && (
              <Badge variant="outline">Personalizado</Badge>
            )}
          </div>
        )}

        {/* Main Filters Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Agent Selector */}
          {showAgentSelector && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled={isLoading}>
                  <Users className="h-4 w-4" />
                  Agentes
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 border-b">
                    <Checkbox
                      id="select-all"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) {
                          (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someSelected;
                        }
                      }}
                      onCheckedChange={handleSelectAllAgents}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Selecionar Todos
                    </label>
                  </div>
                  <ScrollArea className="h-60">
                    <div className="space-y-1">
                      {agents.map((agent) => (
                        <div
                          key={agent.cod_agent}
                          className="flex items-start gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => handleAgentToggle(agent.cod_agent)}
                        >
                          <Checkbox
                            checked={filters.agentCodes.includes(agent.cod_agent)}
                            onCheckedChange={() => handleAgentToggle(agent.cod_agent)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              [{agent.cod_agent}] - {agent.owner_name}
                            </p>
                            {agent.owner_business_name && (
                              <p className="text-xs text-muted-foreground truncate">
                                {agent.owner_business_name}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Date From */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" disabled={isLoading}>
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">De:</span>
                {filters.dateFrom
                  ? format(parseISO(filters.dateFrom), 'dd/MM/yyyy', { locale: ptBR })
                  : 'Início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateFrom ? parseISO(filters.dateFrom) : undefined}
                onSelect={handleDateFromChange}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Date To */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" disabled={isLoading}>
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Até:</span>
                {filters.dateTo
                  ? format(parseISO(filters.dateTo), 'dd/MM/yyyy', { locale: ptBR })
                  : 'Fim'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateTo ? parseISO(filters.dateTo) : undefined}
                onSelect={handleDateToChange}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Perfil Filter */}
          {showPerfilFilter && (
            <Select
              value={filters.perfilAgent || 'ALL'}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, perfilAgent: value as 'SDR' | 'CLOSER' | 'ALL' })
              }
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos Perfis</SelectItem>
                <SelectItem value="SDR">SDR</SelectItem>
                <SelectItem value="CLOSER">Closer</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Status Filter */}
          {showStatusFilter && statusOptions.length > 0 && (
            <Select
              value={filters.statusDocument || 'ALL'}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, statusDocument: value === 'ALL' ? undefined : value })
              }
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos Status</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status] || status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* State Filter */}
          {showStateFilter && stateOptions.length > 0 && (
            <Select
              value={filters.stateFilter || 'all'}
              onValueChange={(value) => onFiltersChange({ ...filters, stateFilter: value })}
            >
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Search Input */}
          {showSearch && (
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                className="pl-9 h-9"
                disabled={isLoading}
              />
            </div>
          )}

          {/* Clear Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            disabled={isLoading}
            className="gap-1"
          >
            <X className="h-4 w-4" />
            Limpar
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
