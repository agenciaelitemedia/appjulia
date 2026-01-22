import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CRMAgent, CRMFiltersState } from '../types';
import { cn } from '@/lib/utils';

interface CRMFiltersProps {
  agents: CRMAgent[];
  filters: CRMFiltersState;
  onFiltersChange: (filters: CRMFiltersState) => void;
  isLoading?: boolean;
}

export function CRMFilters({ agents, filters, onFiltersChange, isLoading }: CRMFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleAgentToggle = (codAgent: string) => {
    const newAgentCodes = filters.agentCodes.includes(codAgent)
      ? filters.agentCodes.filter((c) => c !== codAgent)
      : [...filters.agentCodes, codAgent];
    
    onFiltersChange({ ...filters, agentCodes: newAgentCodes });
  };

  const handleSelectAllAgents = () => {
    const allCodes = agents.map((a) => a.cod_agent);
    const allSelected = allCodes.every((c) => filters.agentCodes.includes(c));
    
    onFiltersChange({
      ...filters,
      agentCodes: allSelected ? [] : allCodes,
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
    const today = format(new Date(), 'yyyy-MM-dd');
    onFiltersChange({
      search: '',
      agentCodes: agents.map((a) => a.cod_agent),
      dateFrom: today,
      dateTo: today,
    });
  };

  const selectedCount = filters.agentCodes.length;
  const allSelected = agents.length > 0 && selectedCount === agents.length;

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
                      checked={allSelected}
                      onCheckedChange={handleSelectAllAgents}
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
                    ? format(new Date(filters.dateFrom), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
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
                    ? format(new Date(filters.dateTo), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                  onSelect={handleDateToChange}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Search */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">Busca</label>
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
