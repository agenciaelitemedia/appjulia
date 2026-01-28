import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CalendarIcon, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  X,
  Users,
  Filter,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getTodayInSaoPaulo,
  getYesterdayInSaoPaulo,
  get7DaysAgoInSaoPaulo,
  get3MonthsAgoInSaoPaulo,
  getFirstDayOfMonthInSaoPaulo,
  getLastDayOfMonthInSaoPaulo,
  getFirstDayOfPreviousMonthInSaoPaulo,
  getLastDayOfPreviousMonthInSaoPaulo,
  getFirstDayOfYearInSaoPaulo,
} from '@/lib/dateUtils';
import { UnifiedFiltersProps } from './types';

type QuickPeriod = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'previousMonth' | 'last3Months' | 'thisYear' | 'custom';

const QUICK_PERIODS: { value: QuickPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7days', label: '7 Dias' },
  { value: 'thisMonth', label: 'Mês Atual' },
  { value: 'previousMonth', label: 'Mês Anterior' },
  { value: 'last3Months', label: '3 Meses' },
  { value: 'thisYear', label: 'Ano Atual' },
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
  periodTooltip,
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
    const last3Months = get3MonthsAgoInSaoPaulo();
    const thisMonthStart = getFirstDayOfMonthInSaoPaulo();
    const thisMonthEnd = getLastDayOfMonthInSaoPaulo();
    const prevMonthStart = getFirstDayOfPreviousMonthInSaoPaulo();
    const prevMonthEnd = getLastDayOfPreviousMonthInSaoPaulo();
    const thisYearStart = getFirstDayOfYearInSaoPaulo();

    if (filters.dateFrom === today && filters.dateTo === today) return 'today';
    if (filters.dateFrom === yesterday && filters.dateTo === yesterday) return 'yesterday';
    if (filters.dateFrom === last7days && filters.dateTo === today) return 'last7days';
    if (filters.dateFrom === thisMonthStart && filters.dateTo === thisMonthEnd) return 'thisMonth';
    if (filters.dateFrom === prevMonthStart && filters.dateTo === prevMonthEnd) return 'previousMonth';
    if (filters.dateFrom === last3Months && filters.dateTo === today) return 'last3Months';
    if (filters.dateFrom === thisYearStart && filters.dateTo === today) return 'thisYear';
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
      case 'thisMonth':
        dateFrom = getFirstDayOfMonthInSaoPaulo();
        dateTo = getLastDayOfMonthInSaoPaulo();
        break;
      case 'previousMonth':
        dateFrom = getFirstDayOfPreviousMonthInSaoPaulo();
        dateTo = getLastDayOfPreviousMonthInSaoPaulo();
        break;
      case 'last3Months':
        dateFrom = get3MonthsAgoInSaoPaulo();
        dateTo = today;
        break;
      case 'thisYear':
        dateFrom = getFirstDayOfYearInSaoPaulo();
        dateTo = today;
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
    <Collapsible 
      open={isOpen} 
      onOpenChange={setIsOpen} 
      className={cn('bg-card border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-300', className)}
    >
      {/* Header */}
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors border-b border-border/50">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Filtros</span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          {showAgentSelector && selectedCount > 0 && (
            <Badge variant="secondary" className="gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary border-0">
              <Users className="h-3 w-3" />
              {selectedCount} {selectedCount === 1 ? 'agente' : 'agentes'}
            </Badge>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="transition-all duration-300 ease-in-out">
        {/* Quick Period Buttons */}
        {showQuickPeriods && (
          <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-1 flex items-center gap-1">
                Período:
                {periodTooltip && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p>{periodTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PERIODS.map((period) => (
                  <Button
                    key={period.value}
                    variant={currentQuickPeriod === period.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleQuickPeriod(period.value)}
                    disabled={isLoading}
                    className={cn(
                      "h-7 px-3 text-xs font-medium rounded-full transition-all duration-200",
                      currentQuickPeriod === period.value 
                        ? "shadow-sm" 
                        : "hover:bg-background hover:shadow-sm hover:border-primary/30 active:scale-95"
                    )}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
              {currentQuickPeriod === 'custom' && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 bg-background border-dashed">
                  Personalizado
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Main Filters Row */}
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Agent Selector */}
            {showAgentSelector && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 gap-2 px-3 bg-background hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 shadow-sm" 
                    disabled={isLoading}
                  >
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Agentes</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 shadow-lg border-border" align="start">
                  <div className="p-3 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) {
                            (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someSelected;
                          }
                        }}
                        onCheckedChange={handleSelectAllAgents}
                        className="data-[state=checked]:bg-primary"
                      />
                      <label htmlFor="select-all" className="text-sm font-medium cursor-pointer flex-1">
                        Selecionar Todos
                      </label>
                      <Badge variant="secondary" className="text-xs">
                        {selectedCount}/{agents.length}
                      </Badge>
                    </div>
                  </div>
                  <ScrollArea className="h-64">
                    <div className="p-2 space-y-0.5">
                      {agents.map((agent) => (
                        <div
                          key={agent.cod_agent}
                          className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleAgentToggle(agent.cod_agent)}
                        >
                          <Checkbox
                            checked={filters.agentCodes.includes(agent.cod_agent)}
                            onCheckedChange={() => handleAgentToggle(agent.cod_agent)}
                            className="mt-0.5 data-[state=checked]:bg-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              [{agent.cod_agent}] {agent.owner_name}
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
                </PopoverContent>
              </Popover>
            )}

            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 gap-2 px-3 bg-background hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 shadow-sm" 
                  disabled={isLoading}
                >
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="hidden sm:inline text-muted-foreground">De:</span>
                  <span className="font-medium">
                    {filters.dateFrom
                      ? format(parseISO(filters.dateFrom), 'dd/MM/yyyy', { locale: ptBR })
                      : 'Início'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 shadow-lg border-border" align="start">
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 gap-2 px-3 bg-background hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 shadow-sm" 
                  disabled={isLoading}
                >
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="hidden sm:inline text-muted-foreground">Até:</span>
                  <span className="font-medium">
                    {filters.dateTo
                      ? format(parseISO(filters.dateTo), 'dd/MM/yyyy', { locale: ptBR })
                      : 'Fim'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 shadow-lg border-border" align="start">
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
                <SelectTrigger className="w-[130px] h-9 bg-background shadow-sm hover:border-primary/30 transition-colors">
                  <SelectValue placeholder="Perfil" />
                </SelectTrigger>
                <SelectContent className="shadow-lg">
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
                <SelectTrigger className="w-[130px] h-9 bg-background shadow-sm hover:border-primary/30 transition-colors">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="shadow-lg">
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
                <SelectTrigger className="w-[150px] h-9 bg-background shadow-sm hover:border-primary/30 transition-colors">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="shadow-lg">
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
                  className="pl-9 h-9 bg-background shadow-sm hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
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
              className="h-9 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-destructive/10 transition-colors"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Limpar</span>
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
