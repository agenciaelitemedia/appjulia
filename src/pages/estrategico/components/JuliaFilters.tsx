import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getTodayInSaoPaulo, getYesterdayInSaoPaulo, get7DaysAgoInSaoPaulo, get30DaysAgoInSaoPaulo, get3MonthsAgoInSaoPaulo, getFirstDayOfMonthInSaoPaulo, getLastDayOfMonthInSaoPaulo, getLastWeekStartInSaoPaulo, getLastWeekEndInSaoPaulo } from '@/lib/dateUtils';
import { CalendarIcon, Filter, Search, X, Calendar as CalendarIconFilled } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { JuliaAgent, JuliaFiltersState } from '../types';
import { cn } from '@/lib/utils';

type QuickPeriod = 'today' | 'yesterday' | 'last7days' | 'lastWeek' | 'last30days' | 'last3months' | 'thisMonth' | 'custom';

interface JuliaFiltersProps {
  agents: JuliaAgent[];
  filters: JuliaFiltersState;
  onFiltersChange: (filters: JuliaFiltersState) => void;
  isLoading?: boolean;
  showPerfilFilter?: boolean;
  showStatusFilter?: boolean;
  statusOptions?: string[];
}

export function JuliaFilters({
  agents,
  filters,
  onFiltersChange,
  isLoading,
  showPerfilFilter = false,
  showStatusFilter = false,
  statusOptions = [],
}: JuliaFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Detect current quick period based on current filters
  const currentQuickPeriod = useMemo((): QuickPeriod => {
    const today = getTodayInSaoPaulo();
    const yesterday = getYesterdayInSaoPaulo();
    const last7Days = get7DaysAgoInSaoPaulo();
    const last30Days = get30DaysAgoInSaoPaulo();
    const last3Months = get3MonthsAgoInSaoPaulo();
    const firstOfMonth = getFirstDayOfMonthInSaoPaulo();
    const lastOfMonth = getLastDayOfMonthInSaoPaulo();
    const lastWeekStart = getLastWeekStartInSaoPaulo();
    const lastWeekEnd = getLastWeekEndInSaoPaulo();

    if (filters.dateFrom === today && filters.dateTo === today) {
      return 'today';
    }
    if (filters.dateFrom === yesterday && filters.dateTo === yesterday) {
      return 'yesterday';
    }
    if (filters.dateFrom === last7Days && filters.dateTo === today) {
      return 'last7days';
    }
    if (filters.dateFrom === lastWeekStart && filters.dateTo === lastWeekEnd) {
      return 'lastWeek';
    }
    if (filters.dateFrom === last30Days && filters.dateTo === today) {
      return 'last30days';
    }
    if (filters.dateFrom === last3Months && filters.dateTo === today) {
      return 'last3months';
    }
    if (filters.dateFrom === firstOfMonth && filters.dateTo === lastOfMonth) {
      return 'thisMonth';
    }
    return 'custom';
  }, [filters.dateFrom, filters.dateTo]);

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

  const handleQuickPeriod = (period: QuickPeriod) => {
    const today = getTodayInSaoPaulo();
    
    switch (period) {
      case 'today':
        onFiltersChange({ ...filters, dateFrom: today, dateTo: today });
        break;
      case 'yesterday':
        const yesterday = getYesterdayInSaoPaulo();
        onFiltersChange({ ...filters, dateFrom: yesterday, dateTo: yesterday });
        break;
      case 'last7days':
        onFiltersChange({ ...filters, dateFrom: get7DaysAgoInSaoPaulo(), dateTo: today });
        break;
      case 'lastWeek':
        onFiltersChange({ 
          ...filters, 
          dateFrom: getLastWeekStartInSaoPaulo(), 
          dateTo: getLastWeekEndInSaoPaulo() 
        });
        break;
      case 'last30days':
        onFiltersChange({ ...filters, dateFrom: get30DaysAgoInSaoPaulo(), dateTo: today });
        break;
      case 'last3months':
        onFiltersChange({ ...filters, dateFrom: get3MonthsAgoInSaoPaulo(), dateTo: today });
        break;
      case 'thisMonth':
        onFiltersChange({ 
          ...filters, 
          dateFrom: getFirstDayOfMonthInSaoPaulo(), 
          dateTo: getLastDayOfMonthInSaoPaulo() 
        });
        break;
    }
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
    const today = getTodayInSaoPaulo();
    onFiltersChange({
      search: '',
      agentCodes: agents.map((a) => a.cod_agent),
      dateFrom: today,
      dateTo: today,
      perfilAgent: 'ALL',
      statusDocument: undefined,
    });
  };

  const dateFromObj = filters.dateFrom ? parseISO(filters.dateFrom) : undefined;
  const dateToObj = filters.dateTo ? parseISO(filters.dateTo) : undefined;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {selectedCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedCount} agente{selectedCount > 1 ? 's' : ''}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="space-y-4">
        {/* Quick Period Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Período:</span>
          <Button
            variant={currentQuickPeriod === 'today' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleQuickPeriod('today')}
          >
            Hoje
          </Button>
          <Button
            variant={currentQuickPeriod === 'yesterday' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleQuickPeriod('yesterday')}
          >
            Ontem
          </Button>
          <Button
            variant={currentQuickPeriod === 'last7days' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleQuickPeriod('last7days')}
          >
            Últimos 7 dias
          </Button>
          <Button
            variant={currentQuickPeriod === 'lastWeek' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleQuickPeriod('lastWeek')}
          >
            Semana passada
          </Button>
          <Button
            variant={currentQuickPeriod === 'last30days' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleQuickPeriod('last30days')}
          >
            Últimos 30 dias
          </Button>
          <Button
            variant={currentQuickPeriod === 'last3months' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleQuickPeriod('last3months')}
          >
            Últimos 3 meses
          </Button>
          <Button
            variant={currentQuickPeriod === 'thisMonth' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleQuickPeriod('thisMonth')}
          >
            Este mês
          </Button>
          {currentQuickPeriod === 'custom' && (
            <Badge variant="secondary" className="text-xs">
              Personalizado
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-lg border">
          {/* Agent Select */}
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">Cod. Agentes</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-start text-left font-normal h-9"
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

          {/* Date From */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data Início</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[140px] justify-start text-left font-normal h-9',
                    !filters.dateFrom && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom
                    ? format(dateFromObj ?? new Date(), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFromObj}
                  onSelect={handleDateFromChange}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data Fim</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[140px] justify-start text-left font-normal h-9',
                    !filters.dateTo && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo
                    ? format(dateToObj ?? new Date(), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateToObj}
                  onSelect={handleDateToChange}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Perfil Filter */}
          {showPerfilFilter && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Perfil</label>
              <Select
                value={filters.perfilAgent || 'ALL'}
                onValueChange={(value) => 
                  onFiltersChange({ ...filters, perfilAgent: value as 'SDR' | 'CLOSER' | 'ALL' })
                }
              >
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="SDR">SDR</SelectItem>
                  <SelectItem value="CLOSER">CLOSER</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status Filter */}
          {showStatusFilter && statusOptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select
                value={filters.statusDocument || 'ALL'}
                onValueChange={(value) => 
                  onFiltersChange({ ...filters, statusDocument: value === 'ALL' ? undefined : value })
                }
              >
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="CREATED">Criado</SelectItem>
                  <SelectItem value="SIGNED">Assinado</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Search */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">Busca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome, WhatsApp..."
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Clear Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-9 gap-1.5"
          >
            <X className="h-4 w-4" />
            Limpar
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
