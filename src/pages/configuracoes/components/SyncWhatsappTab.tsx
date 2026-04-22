import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, X, User, Building2, ChevronRight, Phone, Network,
  ArrowLeft, ArrowRight, Check, Loader2, ClipboardList, Info,
} from 'lucide-react';
import { useAgentsList, type AgentListItem } from '@/pages/agents/hooks/useAgentsList';
import { useCRMCards } from '@/pages/crm/hooks/useCRMData';
import { useClientSearch, type SearchedClient } from '@/pages/agents/hooks/useClientSearch';
import { supabase } from '@/integrations/supabase/client';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';
import type { QueueProvider } from '../hooks/useQueueProviders';

const DATE_FROM = '2026-01-01';

const STEPS = [
  { label: 'Agente', icon: User },
  { label: 'Números', icon: Phone },
  { label: 'Fila', icon: Network },
  { label: 'Resumo', icon: ClipboardList },
];

// ─── Step 1: Agent selector ──────────────────────────────────────────────────

function StepAgent({
  selected,
  onSelect,
}: {
  selected: AgentListItem | null;
  onSelect: (a: AgentListItem) => void;
}) {
  const { data: agents = [], isLoading } = useAgentsList(false, false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return agents.filter(
      (a) =>
        a.cod_agent.toLowerCase().includes(q) ||
        (a.business_name || '').toLowerCase().includes(q) ||
        (a.client_name || '').toLowerCase().includes(q),
    );
  }, [agents, search]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Selecione o Agente</h3>
        <p className="text-sm text-muted-foreground">
          Serão buscados os cards do CRM vinculados a este agente
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cod_agent, nome ou cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-10"
          autoFocus
        />
        {search && (
          <Button
            type="button" variant="ghost" size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearch('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="h-[380px] border rounded-lg">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-[380px] text-muted-foreground">
            <p>Nenhum agente encontrado</p>
          </div>
        ) : (
          <div className="p-2">
            <p className="text-xs text-muted-foreground px-2 py-1 mb-1">
              {filtered.length} agente(s)
            </p>
            {filtered.map((agent) => {
              const isSelected = selected?.cod_agent === agent.cod_agent;
              return (
                <button
                  key={agent.cod_agent}
                  type="button"
                  onClick={() => onSelect(agent)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{agent.business_name || agent.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {agent.cod_agent}
                      {agent.plan_name ? ` · ${agent.plan_name}` : ''}
                    </p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─── Step 2: CRM numbers ─────────────────────────────────────────────────────

function StepNumbers({
  agent,
  numbers,
  onChangeNumbers,
}: {
  agent: AgentListItem;
  numbers: string[];
  onChangeNumbers: (nums: string[]) => void;
}) {
  const today = getTodayInSaoPaulo();
  const { data: cards = [], isLoading } = useCRMCards({
    agentCodes: [agent.cod_agent],
    dateFrom: DATE_FROM,
    dateTo: today,
    search: '',
  });

  const extracted = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    cards.forEach((c) => {
      const n = (c.whatsapp_number || '').replace(/\D/g, '');
      if (n.length >= 8 && !seen.has(n)) {
        seen.add(n);
        result.push(n);
      }
    });
    return result;
  }, [cards]);

  useEffect(() => {
    if (!isLoading && extracted.length > 0) {
      onChangeNumbers(extracted);
    }
  }, [extracted, isLoading]);

  const textareaValue = numbers.join('\n');

  const handleTextareaChange = (value: string) => {
    const seen = new Set<string>();
    const deduped = value
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => {
        if (!l || seen.has(l)) return false;
        seen.add(l);
        return true;
      });
    onChangeNumbers(deduped);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Números WhatsApp</h3>
        <p className="text-sm text-muted-foreground">
          Cards do CRM de <strong>{agent.business_name || agent.cod_agent}</strong> de {DATE_FROM} até hoje
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando cards do CRM...
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline">{cards.length} cards encontrados</Badge>
            <Badge variant="outline">{extracted.length} números únicos extraídos</Badge>
            {numbers.length !== extracted.length && (
              <Badge variant="secondary">{numbers.length} números na lista atual</Badge>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Edite a lista abaixo se quiser remover números antes de prosseguir. Um número por linha.
            </p>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Lista de números (um por linha)</Label>
            <textarea
              className="w-full h-64 p-3 text-sm font-mono border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              value={textareaValue}
              onChange={(e) => handleTextareaChange(e.target.value)}
              placeholder="Nenhum número encontrado"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step 3: Client + queue selector ─────────────────────────────────────────

function StepQueue({
  selectedClient,
  selectedQueue,
  onSelectClient,
  onSelectQueue,
}: {
  selectedClient: SearchedClient | null;
  selectedQueue: QueueProvider | null;
  onSelectClient: (c: SearchedClient) => void;
  onSelectQueue: (q: QueueProvider) => void;
}) {
  const { searchTerm, setSearchTerm, results, isLoading: clientLoading } = useClientSearch();

  const { data: clientQueues = [], isLoading: queuesLoading } = useQuery<QueueProvider[]>({
    queryKey: ['sync-uazapi-queues', selectedClient?.id],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data } = await supabase
        .from('queue_providers')
        .select('*')
        .eq('client_id', String(selectedClient!.id))
        .eq('provider_type', 'uazapi')
        .eq('is_active', true)
        .order('name');
      return (data ?? []) as QueueProvider[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg">Selecione o Cliente e Fila</h3>
        <p className="text-sm text-muted-foreground">
          Escolha o cliente e a fila UaZAPI de conexão para o envio
        </p>
      </div>

      {/* Client search */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Cliente</Label>
        {selectedClient ? (
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-accent/30">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedClient.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {selectedClient.business_name || `ID ${selectedClient.id}`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { onSelectClient(null as any); }}>
              <X className="h-4 w-4 mr-1" /> Trocar
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <div className="relative p-3 border-b">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
                autoFocus
              />
              {searchTerm && (
                <Button
                  type="button" variant="ghost" size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <ScrollArea className="h-[200px]">
              {clientLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchTerm.length < 3 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                  Digite ao menos 3 caracteres
                </div>
              ) : results.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                  Nenhum cliente encontrado
                </div>
              ) : (
                <div className="p-2">
                  {results.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => onSelectClient(client)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {client.business_name || client.email || `ID ${client.id}`}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Queue list */}
      {selectedClient && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Fila UaZAPI</Label>
          {queuesLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando filas...
            </div>
          ) : clientQueues.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Nenhuma fila UaZAPI ativa encontrada para este cliente
            </p>
          ) : (
            <div className="grid gap-2">
              {clientQueues.map((q) => {
                const isSelected = selectedQueue?.id === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onSelectQueue(q)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      isSelected
                        ? 'bg-primary/10 border-primary/30'
                        : 'hover:bg-accent border-border'
                    }`}
                  >
                    <div className="h-9 w-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                      <Network className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{q.name}</p>
                      {q.evo_instance && (
                        <p className="text-xs text-muted-foreground truncate">
                          Instância: {q.evo_instance}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Summary ──────────────────────────────────────────────────────────

function StepSummary({
  agent,
  numbers,
  client,
  queue,
  onChangeNumbers,
}: {
  agent: AgentListItem;
  numbers: string[];
  client: SearchedClient;
  queue: QueueProvider;
  onChangeNumbers: (nums: string[]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Resumo</h3>
        <p className="text-sm text-muted-foreground">
          Confirme os dados antes de prosseguir para a ação de envio
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <User className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Agente</p>
              <p className="font-medium text-sm truncate">{agent.business_name || agent.client_name}</p>
              <p className="text-xs text-muted-foreground">{agent.cod_agent}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Cliente</p>
              <p className="font-medium text-sm truncate">{client.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {client.business_name || `ID ${client.id}`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent className="p-4 flex items-start gap-3">
            <Network className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Fila UaZAPI</p>
              <p className="font-medium text-sm truncate">{queue.name}</p>
              {queue.evo_instance && (
                <p className="text-xs text-muted-foreground">Instância: {queue.evo_instance}</p>
              )}
              {queue.evo_url && (
                <p className="text-xs text-muted-foreground truncate">URL: {queue.evo_url}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Números WhatsApp
            <Badge variant="outline" className="ml-2">{numbers.length}</Badge>
          </Label>
        </div>
        <textarea
          className="w-full h-48 p-3 text-sm font-mono border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          value={numbers.join('\n')}
          onChange={(e) =>
            onChangeNumbers(e.target.value.split('\n').map((l) => l.trim()).filter(Boolean))
          }
        />
      </div>

      <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
        <Info className="h-4 w-4 text-yellow-600 shrink-0" />
        <p className="text-xs text-muted-foreground">
          A ação de envio para o endpoint UaZAPI será configurada na próxima etapa.
        </p>
      </div>

      <Button className="w-full" disabled>
        Confirmar e Enviar (em breve)
      </Button>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function SyncWhatsappTab() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedAgent, setSelectedAgent] = useState<AgentListItem | null>(null);
  const [numbers, setNumbers] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<SearchedClient | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<QueueProvider | null>(null);

  const canAdvance = () => {
    if (step === 1) return !!selectedAgent;
    if (step === 2) return numbers.length > 0;
    if (step === 3) return !!selectedClient && !!selectedQueue;
    return false;
  };

  const handleSelectAgent = (agent: AgentListItem) => {
    if (selectedAgent?.cod_agent !== agent.cod_agent) {
      setNumbers([]);
    }
    setSelectedAgent(agent);
  };

  const handleSelectClient = (client: SearchedClient | null) => {
    setSelectedClient(client);
    setSelectedQueue(null);
  };

  const handlePrev = () => {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
  };

  const handleNext = () => {
    if (canAdvance() && step < 4) setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Sincronizar WhatsApp</h2>
        <p className="text-sm text-muted-foreground">
          Monte a lista de números a partir do CRM e associe a uma fila UaZAPI
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const idx = i + 1;
          const active = step === idx;
          const done = step > idx;
          return (
            <div key={s.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                    done
                      ? 'bg-primary border-primary text-primary-foreground'
                      : active
                      ? 'border-primary text-primary bg-primary/10'
                      : 'border-muted text-muted-foreground bg-background'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <span className={`text-xs ${active ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-5 mx-2 ${done ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="border rounded-lg p-5">
        {step === 1 && (
          <StepAgent selected={selectedAgent} onSelect={handleSelectAgent} />
        )}
        {step === 2 && selectedAgent && (
          <StepNumbers agent={selectedAgent} numbers={numbers} onChangeNumbers={setNumbers} />
        )}
        {step === 3 && (
          <StepQueue
            selectedClient={selectedClient}
            selectedQueue={selectedQueue}
            onSelectClient={handleSelectClient}
            onSelectQueue={setSelectedQueue}
          />
        )}
        {step === 4 && selectedAgent && selectedClient && selectedQueue && (
          <StepSummary
            agent={selectedAgent}
            numbers={numbers}
            client={selectedClient}
            queue={selectedQueue}
            onChangeNumbers={setNumbers}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handlePrev} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        {step < 4 && (
          <Button onClick={handleNext} disabled={!canAdvance()}>
            Próximo <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
