import { useState, useMemo } from 'react';
import { ChevronDown, Check, X, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTribunalList, groupTribunalsByCategory, CATEGORY_ORDER, CATEGORY_LABELS } from '../hooks/useTribunalList';
import { getTribunalColor } from '../utils';

interface TribunalSelectorProps {
  value: string[];
  onChange: (tribunals: string[]) => void;
  disabled?: boolean;
}

export function TribunalSelector({ value, onChange, disabled }: TribunalSelectorProps) {
  const [open, setOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Estadual']);
  const { data: tribunals, isLoading } = useTribunalList();

  const groupedTribunals = useMemo(() => {
    if (!tribunals) return {};
    return groupTribunalsByCategory(tribunals);
  }, [tribunals]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const toggleTribunal = (key: string) => {
    onChange(
      value.includes(key)
        ? value.filter((t) => t !== key)
        : [...value, key]
    );
  };

  const selectAllInCategory = (category: string) => {
    const tribunalsInCategory = groupedTribunals[category]?.map((t) => t.key) || [];
    const allSelected = tribunalsInCategory.every((t) => value.includes(t));
    
    if (allSelected) {
      onChange(value.filter((t) => !tribunalsInCategory.includes(t)));
    } else {
      const newValue = [...new Set([...value, ...tribunalsInCategory])];
      onChange(newValue);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectedCount = value.length;
  const totalCount = tribunals?.length || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled || isLoading}
          className={cn(
            'h-11 px-4 justify-between min-w-[200px]',
            'bg-card/50 hover:bg-card border-2',
            value.length > 0 && 'border-primary/50'
          )}
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {selectedCount === 0 ? (
              <span className="text-muted-foreground">Todos os tribunais</span>
            ) : (
              <span>
                {selectedCount} tribunal{selectedCount !== 1 && 'is'} selecionado{selectedCount !== 1 && 's'}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedCount === 0 ? (
              'Buscar em todos os tribunais'
            ) : (
              `${selectedCount} de ${totalCount} selecionados`
            )}
          </div>
          {selectedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-7 text-xs hover:text-destructive"
            >
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        <ScrollArea className="h-[350px]">
          <div className="p-2 space-y-1">
            {CATEGORY_ORDER.map((category) => {
              const tribunalsInCategory = groupedTribunals[category] || [];
              if (tribunalsInCategory.length === 0) return null;

              const selectedInCategory = tribunalsInCategory.filter((t) =>
                value.includes(t.key)
              ).length;
              const allSelected = selectedInCategory === tribunalsInCategory.length;
              const someSelected = selectedInCategory > 0 && !allSelected;

              return (
                <Collapsible
                  key={category}
                  open={expandedCategories.includes(category)}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <div className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={allSelected}
                      className={cn(someSelected && 'data-[state=checked]:bg-primary/50')}
                      onCheckedChange={() => selectAllInCategory(category)}
                    />
                    <CollapsibleTrigger className="flex-1 flex items-center justify-between hover:bg-muted rounded-md px-2 py-1.5 transition-colors">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn('text-xs', getTribunalColor(category))}
                        >
                          {tribunalsInCategory.length}
                        </Badge>
                        <span className="text-sm font-medium">
                          {CATEGORY_LABELS[category]}
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform',
                          expandedCategories.includes(category) && 'rotate-180'
                        )}
                      />
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="ml-6 pl-2 border-l space-y-1 py-1">
                      {tribunalsInCategory.map((tribunal) => (
                        <label
                          key={tribunal.key}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer',
                            'hover:bg-muted transition-colors',
                            value.includes(tribunal.key) && 'bg-primary/5'
                          )}
                        >
                          <Checkbox
                            checked={value.includes(tribunal.key)}
                            onCheckedChange={() => toggleTribunal(tribunal.key)}
                          />
                          <span className="text-sm">{tribunal.key}</span>
                          <span className="text-xs text-muted-foreground truncate flex-1">
                            {tribunal.name.replace(/Tribunal (de Justiça |Regional )?(do |de |da )?/i, '')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
