import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ArrowLeft, Trash2, AlertTriangle, ChevronRight, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import { useQueryClient } from '@tanstack/react-query';

interface QueueRow {
  id: string;
  client_id: string;
  name: string;
  channel_type: string;
  is_deleted: boolean;
  is_active: boolean;
}

interface PreviewCounts {
  conversations: number;
  messages: number;
  media: number;
}

type Step = 'search' | 'actions' | 'confirm';

export function QueueMaintenanceTab() {
  const [step, setStep] = useState<Step>('search');
  const queryClient = useQueryClient();

  // Step 1
  const [clientFilter, setClientFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const debouncedName = useDebounce(nameFilter, 350);
  const debouncedClient = useDebounce(clientFilter, 350);
  const [queues, setQueues] = useState<QueueRow[]>([]);
  const [searching, setSearching] = useState(false);

  // Selected
  const [selectedQueue, setSelectedQueue] = useState<QueueRow | null>(null);

  // Step 3
  const [preview, setPreview] = useState<PreviewCounts | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ---- Search ----
  useEffect(() => {
    let cancel = false;
    const run = async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke('queue-maintenance', {
          body: {
            action: 'search_queues',
            client_id: debouncedClient.trim() || undefined,
            name: debouncedName.trim() || undefined,
            include_deleted: includeDeleted,
          },
        });
        if (cancel) return;
        if (error) throw error;
        setQueues((data?.queues ?? []) as QueueRow[]);
      } catch (e) {
        if (!cancel) toast.error('Erro ao buscar filas', { description: (e as Error).message });
      } finally {
        if (!cancel) setSearching(false);
      }
    };
    run();
    return () => { cancel = true; };
  }, [debouncedClient, debouncedName, includeDeleted]);

  // ---- Preview when entering confirm ----
  useEffect(() => {
    if (step !== 'confirm' || !selectedQueue) return;
    setPreviewLoading(true);
    setPreview(null);
    setConfirmName('');
    setConfirmSwitch(false);
    supabase.functions
      .invoke('queue-maintenance', { body: { action: 'preview', queue_id: selectedQueue.id } })
      .then(({ data, error }) => {
        if (error) throw error;
        setPreview(data?.counts ?? null);
      })
      .catch((e) => toast.error('Falha ao calcular prévia', { description: (e as Error).message }))
      .finally(() => setPreviewLoading(false));
  }, [step, selectedQueue]);

  const canPurge = useMemo(() => {
    if (!selectedQueue) return false;
    return confirmSwitch && confirmName.trim() === selectedQueue.name.trim() && !submitting;
  }, [confirmSwitch, confirmName, selectedQueue, submitting]);

  const reset = () => {
    setStep('search');
    setSelectedQueue(null);
    setPreview(null);
    setConfirmName('');
    setConfirmSwitch(false);
  };

  const handlePurge = async () => {
    if (!selectedQueue) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('queue-maintenance', {
        body: {
          action: 'purge_messages_and_media',
          queue_id: selectedQueue.id,
          confirm_name: confirmName,
        },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Falha na exclusão');
      const total = data?.total_rows ?? 0;
      toast.success(`Fila limpa: ${total} registros e ${data?.files_deleted ?? 0} arquivos removidos`);
      queryClient.invalidateQueries({ queryKey: ['queues'] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
      reset();
    } catch (e) {
      toast.error('Erro ao excluir', { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  // ============ STEP 1 ============
  if (step === 'search') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" /> Manutenção de Filas
          </h2>
          <p className="text-sm text-muted-foreground">
            Busque uma fila para executar operações de manutenção (limpeza, reset, etc.)
          </p>
        </div>

        <Card className="p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-filter">Cliente (client_id)</Label>
              <Input
                id="client-filter"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                placeholder="Ex: 270"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name-filter">Nome da fila</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-3 text-muted-foreground" />
                <Input
                  id="name-filter"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="Ex: COMERCIAL"
                  className="pl-8"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="incl-del" checked={includeDeleted} onCheckedChange={setIncludeDeleted} />
            <Label htmlFor="incl-del" className="text-sm text-muted-foreground">
              Incluir filas excluídas
            </Label>
          </div>
        </Card>

        <div className="border rounded-md divide-y">
          {searching ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Buscando...
            </div>
          ) : queues.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhuma fila encontrada com os filtros atuais.
            </div>
          ) : (
            queues.map((q) => (
              <button
                key={q.id}
                onClick={() => { setSelectedQueue(q); setStep('actions'); }}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 text-left transition-colors"
              >
                <div>
                  <div className="font-medium text-foreground flex items-center gap-2">
                    {q.name}
                    {q.is_deleted && <Badge variant="outline" className="text-xs">excluída</Badge>}
                    {!q.is_active && !q.is_deleted && <Badge variant="secondary" className="text-xs">inativa</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    client #{q.client_id} · {q.channel_type}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ============ STEP 2 ============
  if (step === 'actions' && selectedQueue) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={reset}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Ações disponíveis</h2>
            <p className="text-sm text-muted-foreground">
              Fila: <span className="font-medium text-foreground">{selectedQueue.name}</span> · client #{selectedQueue.client_id}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4 space-y-3 border-destructive/30">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              <h3 className="font-semibold text-foreground">Excluir todas as mensagens e arquivos</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Remove todas as conversas, mensagens, reações, menções, históricos, logs e os arquivos
              de mídia armazenados desta fila. A fila em si <strong>não</strong> será apagada.
            </p>
            <Button variant="destructive" size="sm" onClick={() => setStep('confirm')}>
              Selecionar
            </Button>
          </Card>

          <Card className="p-4 space-y-2 border-dashed text-muted-foreground">
            <h3 className="font-semibold">Mais ações em breve</h3>
            <p className="text-xs">
              Outras operações de manutenção (reset de credenciais, ressincronização, exportação)
              serão disponibilizadas aqui.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // ============ STEP 3 ============
  if (step === 'confirm' && selectedQueue) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep('actions')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Confirmar exclusão definitiva
            </h2>
            <p className="text-sm text-muted-foreground">
              Fila: <span className="font-medium text-foreground">{selectedQueue.name}</span> · client #{selectedQueue.client_id}
            </p>
          </div>
        </div>

        <Card className="p-4 space-y-4">
          {previewLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calculando prévia...
            </div>
          ) : preview ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Conversas</div>
                <div className="text-2xl font-bold">{preview.conversations.toLocaleString('pt-BR')}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Mensagens</div>
                <div className="text-2xl font-bold">{preview.messages.toLocaleString('pt-BR')}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Arquivos de mídia</div>
                <div className="text-2xl font-bold">{preview.media.toLocaleString('pt-BR')}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Não foi possível obter a prévia.</p>
          )}

          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <strong>Ação irreversível.</strong> Todos os dados de chat desta fila e os arquivos
            no bucket <code className="font-mono">chat-media</code> referenciados pelas mensagens
            serão removidos. A configuração da fila (e vínculos com agentes) será preservada.
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Switch id="confirm-sw" checked={confirmSwitch} onCheckedChange={setConfirmSwitch} />
            <Label htmlFor="confirm-sw" className="text-sm">
              Confirmo a exclusão definitiva e entendo que não há como reverter.
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-name">
              Para confirmar, digite o nome exato da fila: <code className="font-mono">{selectedQueue.name}</code>
            </Label>
            <Input
              id="confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={selectedQueue.name}
              autoComplete="off"
              disabled={!confirmSwitch}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep('actions')} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handlePurge} disabled={!canPurge}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir Tudo
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}