import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Filter, 
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIORITY_CONFIG, STATUS_CONFIG, type DealPriority, type DealStatus } from '../../types';

export interface BoardFiltersState {
  search: string;
  priorities: DealPriority[];
  statuses: DealStatus[];
  pipelineIds: string[];
}

interface BoardFiltersProps {
  filters: BoardFiltersState;
  onFiltersChange: (filters: BoardFiltersState) => void;
  pipelines: { id: string; name: string; color: string }[];
  totalDeals: number;
  filteredDeals: number;
}

export function BoardFilters({
  filters,
  onFiltersChange,
  pipelines,
  totalDeals,
  filteredDeals,
}: BoardFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFiltersCount = 
    filters.priorities.length + 
    filters.statuses.length + 
    filters.pipelineIds.length;

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const handlePriorityToggle = (priority: DealPriority) => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter(p => p !== priority)
      : [...filters.priorities, priority];
    onFiltersChange({ ...filters, priorities: newPriorities });
  };

  const handleStatusToggle = (status: DealStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const handlePipelineToggle = (pipelineId: string) => {
    const newPipelineIds = filters.pipelineIds.includes(pipelineId)
      ? filters.pipelineIds.filter(id => id !== pipelineId)
      : [...filters.pipelineIds, pipelineId];
    onFiltersChange({ ...filters, pipelineIds: newPipelineIds });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      priorities: [],
      statuses: [],
      pipelineIds: [],
    });
  };

  const hasActiveFilters = filters.search || activeFiltersCount > 0;

  return (
    <div className="flex items-center gap-3">
      {/* Search Input */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título, contato, telefone..."
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={() => handleSearchChange('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Filters Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "gap-2",
              activeFiltersCount > 0 && "border-primary"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Filtros</h4>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-7 text-xs"
                >
                  Limpar tudo
                </Button>
              )}
            </div>

            {/* Priority Filter */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Prioridade</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PRIORITY_CONFIG) as DealPriority[]).map((priority) => (
                  <button
                    key={priority}
                    onClick={() => handlePriorityToggle(priority)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full border transition-colors",
                      filters.priorities.includes(priority)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    {PRIORITY_CONFIG[priority].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUS_CONFIG) as DealStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusToggle(status)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full border transition-colors",
                      filters.statuses.includes(status)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    {STATUS_CONFIG[status].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pipeline Filter */}
            {pipelines.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Etapas</Label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {pipelines.map((pipeline) => (
                    <label
                      key={pipeline.id}
                      className="flex items-center gap-2 cursor-pointer py-1"
                    >
                      <Checkbox
                        checked={filters.pipelineIds.includes(pipeline.id)}
                        onCheckedChange={() => handlePipelineToggle(pipeline.id)}
                      />
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: pipeline.color }}
                      />
                      <span className="text-sm">{pipeline.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Results count */}
      {hasActiveFilters && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filteredDeals} de {totalDeals} deals
        </span>
      )}
    </div>
  );
}
