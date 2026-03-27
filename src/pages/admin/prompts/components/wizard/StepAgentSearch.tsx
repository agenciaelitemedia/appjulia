import { Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAgentSearch, SearchedAgent } from '@/pages/agents/hooks/useAgentSearch';

export interface StepAgentSearchProps {
  selected: SearchedAgent | null;
  onSelect: (agent: SearchedAgent) => void;
  onNext: () => void;
  readOnly?: boolean;
}

export function StepAgentSearch({ selected, onSelect, onNext, readOnly }: StepAgentSearchProps) {
  const { searchTerm, setSearchTerm, results, isLoading, error } = useAgentSearch();

  if (readOnly && selected) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Agente (somente leitura)</h3>
          <p className="text-sm text-muted-foreground">O agente não pode ser alterado na edição</p>
        </div>
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-3">
            <p className="text-sm font-semibold">Agente selecionado:</p>
            <p className="text-sm">[{selected.cod_agent}] - {selected.client_name}</p>
            {selected.business_name && <p className="text-xs text-muted-foreground">{selected.business_name}</p>}
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button onClick={onNext}>Próximo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Selecione o Agente</h3>
        <p className="text-sm text-muted-foreground">Busque por código, nome do cliente ou nome do escritório</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar agente..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>}
      {error && <p className="text-sm text-destructive text-center py-4">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {results.map(agent => (
            <Card
              key={agent.id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                selected?.id === agent.id ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => onSelect(agent)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">[{agent.cod_agent}] - {agent.client_name}</p>
                  {agent.business_name && (
                    <p className="text-xs text-muted-foreground">{agent.business_name}</p>
                  )}
                </div>
                {selected?.id === agent.id && <Check className="h-4 w-4 text-primary" />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-3">
            <p className="text-sm font-semibold">Agente selecionado:</p>
            <p className="text-sm">[{selected.cod_agent}] - {selected.client_name}</p>
            {selected.business_name && <p className="text-xs text-muted-foreground">{selected.business_name}</p>}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!selected}>Próximo</Button>
      </div>
    </div>
  );
}
