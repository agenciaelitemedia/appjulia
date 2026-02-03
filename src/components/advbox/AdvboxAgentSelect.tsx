import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Search, Loader2 } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

interface AgentOption {
  agent_id: number;
  cod_agent: string;
  client_name: string;
  business_name?: string;
}

interface AdvboxAgentSelectProps {
  value: string | null;
  onValueChange: (codAgent: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function AdvboxAgentSelect({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Selecione um agente",
  className,
}: AdvboxAgentSelectProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAgents = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      try {
        const result = await externalDb.getUserAgents<{
          agent_id: number;
          cod_agent: string;
          client_name: string;
          business_name?: string;
        }>(user.id);
        
        setAgents(result);
        
        // Auto-select first agent if only one exists
        if (result.length === 1 && !value) {
          onValueChange(result[0].agent_id);
        }
      } catch (error) {
        console.error('Error loading agents:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAgents();
  }, [user?.id]);

  const selectedAgent = agents.find((agent) => agent.agent_id === value);

  const displayValue = selectedAgent
    ? `[${selectedAgent.cod_agent}] - ${selectedAgent.client_name}`
    : placeholder;

  if (isLoading) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn("w-full justify-between font-normal", className)}
      >
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Carregando agentes...
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || agents.length === 0}
          className={cn(
            "w-full justify-between font-normal",
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
                <CommandItem
                  key={agent.agent_id}
                  value={`${agent.cod_agent} ${agent.client_name} ${agent.business_name || ''}`}
                  onSelect={() => {
                    onValueChange(agent.agent_id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === agent.agent_id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="font-medium truncate">
                      [{agent.cod_agent}] - {agent.client_name}
                    </span>
                    {agent.business_name && (
                      <span className="text-xs text-muted-foreground truncate">
                        {agent.business_name}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
