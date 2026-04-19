import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AgentOption } from './AgentMultiSelectPopover';

interface Props {
  agents: AgentOption[];
  value: string | null;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function AgentSingleSelectPopover({
  agents,
  value,
  onChange,
  disabled,
  className,
  placeholder = 'Selecione um agente',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => {
      const label = `${a.alias ?? ''} ${a.owner_name ?? ''} ${a.owner_business_name ?? ''} ${a.cod_agent}`.toLowerCase();
      return label.includes(q);
    });
  }, [agents, search]);

  const selected = useMemo(
    () => (value ? agents.find((a) => a.cod_agent === value) : null),
    [agents, value]
  );

  const label = useMemo(() => {
    if (!selected) return placeholder;
    const name = selected.alias || selected.owner_name || selected.owner_business_name || '';
    return name ? `[${selected.cod_agent}] - ${name}` : `[${selected.cod_agent}]`;
  }, [selected, placeholder]);

  const handleSelect = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('justify-between h-8 text-xs font-normal', className)}
        >
          <span className="flex items-center gap-2 truncate">
            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar agente..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
        <ScrollArea className="max-h-[320px]">
          <div className="p-1">
            {filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground px-3 py-4 text-center">
                Nenhum agente encontrado
              </div>
            ) : (
              filtered.map((agent) => {
                const isSelected = value === agent.cod_agent;
                const display =
                  agent.alias ||
                  agent.owner_name ||
                  agent.owner_business_name ||
                  agent.cod_agent;
                return (
                  <button
                    key={agent.cod_agent}
                    onClick={() => handleSelect(agent.cod_agent)}
                    className={cn(
                      'flex items-center gap-2 w-full text-xs hover:bg-accent rounded px-2 py-1.5 text-left',
                      isSelected && 'bg-accent'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">
                        [{agent.cod_agent}] - {display}
                      </div>
                      {agent.owner_business_name && agent.owner_business_name !== display && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {agent.owner_business_name}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}