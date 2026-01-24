import { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface AgentOption {
  cod_agent: string;
  owner_name: string;
  owner_business_name?: string;
}

interface AgentSearchSelectProps {
  agents: AgentOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function AgentSearchSelect({
  agents,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Selecione um agente",
  className,
}: AgentSearchSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedAgent = agents.find((agent) => agent.cod_agent === value);

  const displayValue = selectedAgent
    ? `[${selectedAgent.cod_agent}] - ${selectedAgent.owner_name}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-[280px] justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 bg-popover border border-border shadow-lg z-50" align="start">
        <Command className="bg-transparent">
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder="Buscar agente..." 
              className="h-10 border-0 focus:ring-0"
            />
          </div>
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Nenhum agente encontrado.</CommandEmpty>
            <CommandGroup>
              {agents.map((agent) => (
                <TooltipProvider key={agent.cod_agent} delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CommandItem
                        value={`${agent.cod_agent} ${agent.owner_name} ${agent.owner_business_name || ''}`}
                        onSelect={() => {
                          onValueChange(agent.cod_agent);
                          setOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === agent.cod_agent ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <span className="font-medium truncate">
                            [{agent.cod_agent}] - {agent.owner_name}
                          </span>
                          {agent.owner_business_name && (
                            <span className="text-xs text-muted-foreground truncate">
                              {agent.owner_business_name}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    </TooltipTrigger>
                    {agent.owner_business_name && (
                      <TooltipContent side="right" className="max-w-[250px]">
                        <p className="font-medium">{agent.owner_name}</p>
                        <p className="text-xs text-muted-foreground">{agent.owner_business_name}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
