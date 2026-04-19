import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface AgentOption {
  cod_agent: string;
  owner_name?: string;
  owner_business_name?: string;
  alias?: string;
}

interface Props {
  agents: AgentOption[];
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function AgentMultiSelectPopover({
  agents,
  value,
  onChange,
  disabled,
  className,
  placeholder = 'Selecione agentes',
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

  const allSelected = agents.length > 0 && value.length === agents.length;
  const selectedSet = useMemo(() => new Set(value), [value]);

  const toggle = (code: string) => {
    if (selectedSet.has(code)) {
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  };

  const toggleAll = () => {
    onChange(allSelected ? [] : agents.map((a) => a.cod_agent));
  };

  const label = useMemo(() => {
    if (value.length === 0) return placeholder;
    if (allSelected) return `Todos (${agents.length})`;
    if (value.length === 1) {
      const a = agents.find((x) => x.cod_agent === value[0]);
      return a?.alias || a?.owner_name || a?.cod_agent || '1 agente';
    }
    return `${value.length} agentes`;
  }, [value, agents, allSelected, placeholder]);

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
        <div className="px-2 py-1.5 border-b">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 w-full text-xs hover:bg-accent rounded px-2 py-1.5"
          >
            <Checkbox checked={allSelected} className="pointer-events-none" />
            <span className="font-medium">{allSelected ? 'Desmarcar todos' : 'Selecionar todos'}</span>
          </button>
        </div>
        <ScrollArea className="max-h-[280px]">
          <div className="p-1">
            {filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground px-3 py-4 text-center">
                Nenhum agente encontrado
              </div>
            ) : (
              filtered.map((agent) => {
                const checked = selectedSet.has(agent.cod_agent);
                const display =
                  agent.alias ||
                  agent.owner_name ||
                  agent.owner_business_name ||
                  agent.cod_agent;
                return (
                  <button
                    key={agent.cod_agent}
                    onClick={() => toggle(agent.cod_agent)}
                    className="flex items-center gap-2 w-full text-xs hover:bg-accent rounded px-2 py-1.5 text-left"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{display}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        #{agent.cod_agent}
                      </div>
                    </div>
                    {checked && <Check className="h-3 w-3 text-primary shrink-0" />}
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
