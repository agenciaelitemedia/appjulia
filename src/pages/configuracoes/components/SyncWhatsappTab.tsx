import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import {
  Search, X, User, Building2, ChevronRight, Phone, Network,
  ArrowLeft, ArrowRight, Check, Loader2, ClipboardList, Info,
  CalendarIcon, Flame, Download, CheckCircle2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAgentsList, type AgentListItem } from '@/pages/agents/hooks/useAgentsList';
import { useCRMCards } from '@/pages/crm/hooks/useCRMData';
import { useClientSearch, type SearchedClient } from '@/pages/agents/hooks/useClientSearch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';
import { toast } from 'sonner';
import type { QueueProvider } from '../hooks/useQueueProviders';

const DEFAULT_DATE_FROM = '2026-01-01';

const STEPS = [
  { label: 'Agente', icon: User },
  { label: 'Números', icon: Phone },
  { label: 'Fila', icon: Network },
  { label: 'Resumo', icon: ClipboardList },
  { label: 'Aquecimento', icon: Flame },
  { label: 'Importação', icon: Download },
];

type Step = 1 | 2 | 3 | 4 | 5 | 6;

// ─── Step 1: Agent selector ──────────────────────────────────────────────────
function StepAgent({ selected, onSelect }: { selected: AgentListItem | null; onSelect: (a: AgentListItem) => void }) {
  const { data: agents = [], isLoading } = useAgentsList(false, false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return agents.filter((a) =>
      a.cod_agent.toLowerCase().includes(q) ||
      (a.business_name || '').toLowerCase().includes(q) ||
      (a.client_name || '').toLowerCase().includes(q),
    );
  }, [agents, search]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Selecione o Agente</h3>
        <p className="text-sm text-muted-foreground">Serão buscados os cards do CRM vinculados a este agente</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por cod_agent, nome ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-10" autoFocus />
        {search && (
          <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch('')}>
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
                <div className="space-y-2 flex-1"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-28" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-[380px] text-muted-foreground"><p>Nenhum agente encontrado</p></div>
        ) : (
          <div className="p-2">
            <p className="text-xs text-muted-foreground px-2 py-1 mb-1">{filtered.length} agente(s)</p>
            {filtered.map((agent) => {
              const isSelected = selected?.cod_agent === agent.cod_agent;
              return (
                <button key={agent.cod_agent} type="button" onClick={() => onSelect(agent)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent'}`}>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><User className="h-5 w-5 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{agent.business_name || agent.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{agent.cod_agent}{agent.plan_name ? ` · ${agent.plan_name}` : ''}</p>
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

// ─── Step 2: CRM numbers with date pickers ───────────────────────────────────
function StepNumbers({
  agent, numbers, onChangeNumbers, dateFrom, dateTo, onChangeDateFrom, onChangeDateTo,
}: {
  agent: AgentListItem;
  numbers: string[];
  onChangeNumbers: (nums: string[]) => void;
  dateFrom: string;
  dateTo: string;
  onChangeDateFrom: (v: string) => void;
  onChangeDateTo: (v: string) => void;
}) {
  const { data: cards = [], isLoading } = useCRMCards({
    agentCodes: [agent.cod_agent],
    dateFrom, dateTo, search: '',
  });

  const extracted = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    cards.forEach((c) => {
      const n = (c.whatsapp_number || '').replace(/\D/g, '');
      if (n.length >= 8 && !seen.has(n)) { seen.add(n); result.push(n); }
    });
    return result;
  }, [cards]);

  // Re-extract when date range changes
  useEffect(() => {
    if (!isLoading) onChangeNumbers(extracted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extracted, isLoading]);

  const dateFromObj = parseISO(dateFrom + 'T00:00:00');
  const dateToObj = parseISO(dateTo + 'T00:00:00');
  const invalidRange = dateFromObj > dateToObj;

  const handleTextareaChange = (value: string) => {
    const seen = new Set<string>();
    const deduped = value.split('\n').map((l) => l.trim()).filter((l) => {
      if (!l || seen.has(l)) return false;
      seen.add(l); return true;
    });
    onChangeNumbers(deduped);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Números WhatsApp</h3>
        <p className="text-sm text-muted-foreground">
          Cards do CRM de <strong>{agent.business_name || agent.cod_agent}</strong> no período selecionado
        </p>
      </div>

      {/* Date pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Data inicial</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateFromObj, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFromObj}
                onSelect={(d) => d && onChangeDateFrom(format(d, 'yyyy-MM-dd'))}
                initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Data final</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateToObj, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateToObj}
                onSelect={(d) => d && onChangeDateTo(format(d, 'yyyy-MM-dd'))}
                initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {invalidRange && (
        <p className="text-xs text-destructive">A data inicial deve ser menor ou igual à data final.</p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando cards do CRM...
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
            <p className="text-xs text-muted-foreground">Edite a lista abaixo se quiser remover números antes de prosseguir. Um número por linha.</p>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Lista de números (um por linha)</Label>
            <textarea className="w-full h-64 p-3 text-sm font-mono border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              value={numbers.join('\n')} onChange={(e) => handleTextareaChange(e.target.value)}
              placeholder="Nenhum número encontrado" />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step 3: Client + queue selector ─────────────────────────────────────────
function StepQueue({
  selectedClient, selectedQueue, onSelectClient, onSelectQueue,
}: {
  selectedClient: SearchedClient | null;
  selectedQueue: QueueProvider | null;
  onSelectClient: (c: SearchedClient | null) => void;
  onSelectQueue: (q: QueueProvider) => void;
}) {
  const { searchTerm, setSearchTerm, results, isLoading: clientLoading } = useClientSearch();
  const { data: clientQueues = [], isLoading: queuesLoading } = useQuery<QueueProvider[]>({
    queryKey: ['sync-uazapi-queues', selectedClient?.id],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data } = await supabase.from('queue_providers').select('*')
        .eq('client_id', String(selectedClient!.id))
        .eq('provider_type', 'uazapi').eq('is_active', true).order('name');
      return (data ?? []) as QueueProvider[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg">Selecione o Cliente e Fila</h3>
        <p className="text-sm text-muted-foreground">Escolha o cliente e a fila UaZAPI de conexão para o envio</p>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Cliente</Label>
        {selectedClient ? (
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-accent/30">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedClient.name}</p>
              <p className="text-xs text-muted-foreground truncate">{selectedClient.business_name || `ID ${selectedClient.id}`}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onSelectClient(null)}><X className="h-4 w-4 mr-1" /> Trocar</Button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <div className="relative p-3 border-b">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-10" autoFocus />
              {searchTerm && (
                <Button type="button" variant="ghost" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchTerm('')}>
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
                      <div className="space-y-1 flex-1"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-24" /></div>
                    </div>
                  ))}
                </div>
              ) : searchTerm.length < 3 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">Digite ao menos 3 caracteres</div>
              ) : results.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">Nenhum cliente encontrado</div>
              ) : (
                <div className="p-2">
                  {results.map((client) => (
                    <button key={client.id} type="button" onClick={() => onSelectClient(client)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-primary" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{client.business_name || client.email || `ID ${client.id}`}</p>
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
      {selectedClient && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Fila UaZAPI</Label>
          {queuesLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando filas...</div>
          ) : clientQueues.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhuma fila UaZAPI ativa encontrada para este cliente</p>
          ) : (
            <div className="grid gap-2">
              {clientQueues.map((q) => {
                const isSelected = selectedQueue?.id === q.id;
                return (
                  <button key={q.id} type="button" onClick={() => onSelectQueue(q)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${isSelected ? 'bg-primary/10 border-primary/30' : 'hover:bg-accent border-border'}`}>
                    <div className="h-9 w-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0"><Network className="h-4 w-4 text-green-600" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{q.name}</p>
                      {q.evo_url && <p className="text-xs text-muted-foreground truncate">URL: {q.evo_url}</p>}
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
  agent, numbers, client, queue, dateFrom, dateTo, onChangeNumbers,
}: {
  agent: AgentListItem; numbers: string[]; client: SearchedClient; queue: QueueProvider;
  dateFrom: string; dateTo: string; onChangeNumbers: (nums: string[]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Resumo</h3>
        <p className="text-sm text-muted-foreground">Confirme os dados antes de iniciar o aquecimento</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card><CardContent className="p-4 flex items-start gap-3">
          <User className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Agente</p>
            <p className="font-medium text-sm truncate">{agent.business_name || agent.client_name}</p>
            <p className="text-xs text-muted-foreground">{agent.cod_agent}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-start gap-3">
          <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Cliente</p>
            <p className="font-medium text-sm truncate">{client.name}</p>
            <p className="text-xs text-muted-foreground truncate">{client.business_name || `ID ${client.id}`}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-start gap-3">
          <Network className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Fila UaZAPI</p>
            <p className="font-medium text-sm truncate">{queue.name}</p>
            {queue.evo_url && <p className="text-xs text-muted-foreground truncate">URL: {queue.evo_url}</p>}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-start gap-3">
          <CalendarIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Período</p>
            <p className="font-medium text-sm">
              {format(parseISO(dateFrom + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
              {' → '}
              {format(parseISO(dateTo + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>
        </CardContent></Card>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Números WhatsApp <Badge variant="outline" className="ml-2">{numbers.length}</Badge></Label>
        </div>
        <textarea className="w-full h-48 p-3 text-sm font-mono border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          value={numbers.join('\n')}
          onChange={(e) => onChangeNumbers(e.target.value.split('\n').map((l) => l.trim()).filter(Boolean))} />
      </div>
      <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
        <Info className="h-4 w-4 text-yellow-600 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Próximo passo: <strong>aquecimento</strong> — solicitar à UaZapi que baixe o histórico de cada número (rápido, ~5 paralelos).
        </p>
      </div>
    </div>
  );
}

// ─── Step 5: Warmup ──────────────────────────────────────────────────────────
function StepWarmup({
  numbers, queue, onComplete,
}: { numbers: string[]; queue: QueueProvider; onComplete: () => void }) {
  const [progress, setProgress] = useState({ done: 0, total: numbers.length, success: 0, failed: 0 });
  const [results, setResults] = useState<Array<{ phone: string; ok: boolean; error?: string }>>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');

  const startWarmup = useMutation({
    mutationFn: async () => {
      setStatus('running');
      setProgress({ done: 0, total: numbers.length, success: 0, failed: 0 });
      setResults([]);
      // Process in batches of 5 from the client (each call hits warmup function with 5 numbers)
      const BATCH = 5;
      const aggregated: Array<{ phone: string; ok: boolean; error?: string }> = [];
      let success = 0;
      let failed = 0;
      for (let i = 0; i < numbers.length; i += BATCH) {
        const slice = numbers.slice(i, i + BATCH);
        const { data, error } = await supabase.functions.invoke('uazapi-history-warmup', {
          body: { evo_url: queue.evo_url, evo_token: queue.evo_apikey, numbers: slice, count: 100, batch_size: BATCH },
        });
        if (error) {
          slice.forEach((p) => { aggregated.push({ phone: p, ok: false, error: error.message }); failed++; });
        } else {
          const r = (data?.results ?? []) as Array<{ phone: string; ok: boolean; error?: string }>;
          aggregated.push(...r);
          success += r.filter((x) => x.ok).length;
          failed += r.filter((x) => !x.ok).length;
        }
        setResults([...aggregated]);
        setProgress({ done: Math.min(i + BATCH, numbers.length), total: numbers.length, success, failed });
      }
      setStatus(failed === numbers.length ? 'error' : 'done');
    },
    onError: (e: Error) => { setStatus('error'); toast.error('Falha no aquecimento: ' + e.message); },
  });

  useEffect(() => {
    if (status === 'idle') startWarmup.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg flex items-center gap-2"><Flame className="h-5 w-5 text-orange-500" /> Aquecimento de Histórico</h3>
        <p className="text-sm text-muted-foreground">
          Solicitando à UaZapi que baixe o histórico de cada número (endpoint <code className="text-xs bg-muted px-1 rounded">/message/history-sync</code>).
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Progresso: {progress.done}/{progress.total}</span>
          <span className="text-muted-foreground">
            <span className="text-green-600">{progress.success} OK</span>
            {progress.failed > 0 && <> · <span className="text-red-600">{progress.failed} falhas</span></>}
          </span>
        </div>
        <Progress value={pct} />
      </div>
      <ScrollArea className="h-64 border rounded-lg p-2">
        {results.length === 0 ? (
          <div className="flex items-center justify-center h-60 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Aguardando primeiros resultados...
          </div>
        ) : (
          <div className="space-y-1">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-accent">
                {r.ok ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <X className="h-3 w-3 text-red-600" />}
                <span className="font-mono">{r.phone}</span>
                {r.error && <span className="text-red-600 truncate">{r.error}</span>}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="flex items-center gap-2">
        {status === 'done' && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20 flex-1">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <p className="text-xs text-muted-foreground">Aquecimento concluído. Pronto para buscar mensagens.</p>
          </div>
        )}
        {status === 'error' && (
          <Button variant="outline" onClick={() => startWarmup.mutate()}>Tentar novamente</Button>
        )}
        <Button onClick={onComplete} disabled={status !== 'done'} className="ml-auto">
          Buscar Mensagens (Etapa B) <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 6: Import dispatch ──────────────────────────────────────────────────
function StepImport({
  agent, numbers, client, queue, dateFrom, dateTo, onReset,
}: {
  agent: AgentListItem; numbers: string[]; client: SearchedClient; queue: QueueProvider;
  dateFrom: string; dateTo: string; onReset: () => void;
}) {
  const { user } = useAuth();
  const [jobId, setJobId] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState(false);

  const startImport = useMutation({
    mutationFn: async () => {
      // 1. Insert job
      const { data: job, error: jErr } = await supabase
        .from('whatsapp_sync_jobs')
        .insert({
          client_id: String(client.id),
          client_name: client.name,
          queue_id: queue.id,
          queue_name: queue.name,
          cod_agent: agent.cod_agent,
          agent_name: agent.business_name || agent.client_name,
          phase: 'message_find',
          status: 'running',
          date_from: dateFrom,
          date_to: dateTo,
          total_numbers: numbers.length,
          numbers: numbers as any,
          evo_url: queue.evo_url,
          evo_token: queue.evo_apikey,
          created_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (jErr || !job) throw new Error(jErr?.message || 'Falha ao criar job');

      // 2. Fire background processor
      const { error: fErr } = await supabase.functions.invoke('uazapi-history-import', {
        body: { job_id: job.id },
      });
      if (fErr) throw fErr;
      return job.id as string;
    },
    onSuccess: (id) => {
      setJobId(id);
      setDispatched(true);
      toast.success('Importação iniciada em background');
    },
    onError: (e: Error) => toast.error('Falha ao iniciar importação: ' + e.message),
  });

  useEffect(() => {
    if (!dispatched && !startImport.isPending) startImport.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg flex items-center gap-2"><Download className="h-5 w-5 text-primary" /> Importação de Mensagens</h3>
        <p className="text-sm text-muted-foreground">
          Buscando mensagens via <code className="text-xs bg-muted px-1 rounded">/message/find</code> e gravando no banco em background.
        </p>
      </div>

      {startImport.isPending && (
        <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Iniciando importação...
        </div>
      )}

      {dispatched && (
        <>
          <div className="flex items-start gap-2 p-4 rounded-md bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-sm">Importação em andamento</p>
              <p className="text-xs text-muted-foreground">
                Estamos processando <strong>{numbers.length}</strong> números em background.
                Isso pode levar de 30 minutos a 3 horas. Você pode fechar esta aba — o processo continua.
              </p>
              {jobId && (
                <p className="text-xs text-muted-foreground">
                  ID do job: <code className="bg-muted px-1 rounded text-xs">{jobId.slice(0, 8)}</code>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Acompanhe o progresso e os logs por número na aba <strong>Histórico de Sincronização</strong>.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={onReset} variant="outline">
              <Check className="h-4 w-4 mr-2" /> Concluir e iniciar nova sincronização
            </Button>
          </div>
        </>
      )}

      {startImport.isError && (
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => startImport.mutate()}>Tentar novamente</Button>
        </div>
      )}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
export function SyncWhatsappTab() {
  const today = getTodayInSaoPaulo();
  const [step, setStep] = useState<Step>(1);
  const [selectedAgent, setSelectedAgent] = useState<AgentListItem | null>(null);
  const [numbers, setNumbers] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string>(DEFAULT_DATE_FROM);
  const [dateTo, setDateTo] = useState<string>(today);
  const [selectedClient, setSelectedClient] = useState<SearchedClient | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<QueueProvider | null>(null);

  const dateRangeValid = parseISO(dateFrom + 'T00:00:00') <= parseISO(dateTo + 'T00:00:00');

  const canAdvance = () => {
    if (step === 1) return !!selectedAgent;
    if (step === 2) return numbers.length > 0 && dateRangeValid;
    if (step === 3) return !!selectedClient && !!selectedQueue;
    if (step === 4) return true;
    return false;
  };

  const handleSelectAgent = (agent: AgentListItem) => {
    if (selectedAgent?.cod_agent !== agent.cod_agent) setNumbers([]);
    setSelectedAgent(agent);
  };

  const handleSelectClient = (client: SearchedClient | null) => {
    setSelectedClient(client);
    setSelectedQueue(null);
  };

  const handlePrev = () => { if (step > 1 && step < 5) setStep((s) => (s - 1) as Step); };
  const handleNext = () => { if (canAdvance() && step < 6) setStep((s) => (s + 1) as Step); };

  const handleReset = () => {
    setStep(1);
    setSelectedAgent(null);
    setNumbers([]);
    setSelectedClient(null);
    setSelectedQueue(null);
    setDateFrom(DEFAULT_DATE_FROM);
    setDateTo(today);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Sincronizar WhatsApp</h2>
        <p className="text-sm text-muted-foreground">
          Importa o histórico de mensagens de cada número do CRM para o módulo Chat
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
                <div className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors ${done ? 'bg-primary border-primary text-primary-foreground' : active ? 'border-primary text-primary bg-primary/10' : 'border-muted text-muted-foreground bg-background'}`}>
                  {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <span className={`text-[10px] sm:text-xs ${active ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mb-5 mx-2 ${done ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          );
        })}
      </div>

      <div className="border rounded-lg p-5">
        {step === 1 && <StepAgent selected={selectedAgent} onSelect={handleSelectAgent} />}
        {step === 2 && selectedAgent && (
          <StepNumbers agent={selectedAgent} numbers={numbers} onChangeNumbers={setNumbers}
            dateFrom={dateFrom} dateTo={dateTo}
            onChangeDateFrom={setDateFrom} onChangeDateTo={setDateTo} />
        )}
        {step === 3 && (
          <StepQueue selectedClient={selectedClient} selectedQueue={selectedQueue}
            onSelectClient={handleSelectClient} onSelectQueue={setSelectedQueue} />
        )}
        {step === 4 && selectedAgent && selectedClient && selectedQueue && (
          <StepSummary agent={selectedAgent} numbers={numbers} client={selectedClient} queue={selectedQueue}
            dateFrom={dateFrom} dateTo={dateTo} onChangeNumbers={setNumbers} />
        )}
        {step === 5 && selectedQueue && (
          <StepWarmup numbers={numbers} queue={selectedQueue} onComplete={() => setStep(6)} />
        )}
        {step === 6 && selectedAgent && selectedClient && selectedQueue && (
          <StepImport agent={selectedAgent} numbers={numbers} client={selectedClient} queue={selectedQueue}
            dateFrom={dateFrom} dateTo={dateTo} onReset={handleReset} />
        )}
      </div>

      {step < 5 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handlePrev} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          {step < 4 ? (
            <Button onClick={handleNext} disabled={!canAdvance()}>
              Próximo <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={() => setStep(5)} disabled={!canAdvance()}>
              <Flame className="h-4 w-4 mr-2" /> Iniciar Aquecimento
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
