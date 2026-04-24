import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClientItem {
  client_id: string;
  queues_count: number;
}

export function ResetChatDialog({ open, onOpenChange }: Props) {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [includeSync, setIncludeSync] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clearingMedia, setClearingMedia] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setSelectedClientId('all');
    setIncludeSync(false);
    setConfirmText('');
    setLoadingClients(true);
    supabase.functions
      .invoke('chat-reset', { body: { action: 'list_clients' } })
      .then(({ data, error }) => {
        if (error) {
          toast.error('Falha ao carregar clientes');
          return;
        }
        setClients((data?.clients ?? []) as ClientItem[]);
      })
      .finally(() => setLoadingClients(false));
  }, [open]);

  const canConfirm = confirmText.trim().toUpperCase() === 'RESETAR' && !submitting;

  const handleClearMedia = async () => {
    if (!confirm('Remover TODOS os arquivos do bucket chat-media? Esta ação é irreversível.')) return;
    setClearingMedia(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-reset', {
        body: { action: 'clear_storage', bucket: 'chat-media' },
      });
      if (error) throw error;
      toast.success(`Mídias removidas: ${data?.deleted ?? 0} de ${data?.total ?? 0}`);
    } catch (err) {
      toast.error('Erro ao limpar mídias', { description: (err as Error).message });
    } finally {
      setClearingMedia(false);
    }
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-reset', {
        body: {
          action: 'reset',
          client_id: selectedClientId,
          include_sync: includeSync,
        },
      });
      if (error) throw error;
      const deleted = (data?.deleted ?? {}) as Record<string, number>;
      const total = Object.values(deleted).reduce((a, b) => a + b, 0);
      toast.success(`Reset concluído: ${total} registros removidos`, {
        description: Object.entries(deleted)
          .filter(([, n]) => n > 0)
          .map(([t, n]) => `${t}: ${n}`)
          .join(' • ') || 'Nenhuma linha afetada',
      });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro ao resetar', { description: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" /> Resetar Chat
          </DialogTitle>
          <DialogDescription>
            Esta ação remove permanentemente todas as conversas, mensagens, contatos e os
            registros gerados pelos webhooks (UaZapi history, fila e logs de webhook) do escopo selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Escopo</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={loadingClients}>
              <SelectTrigger>
                <SelectValue placeholder={loadingClients ? 'Carregando...' : 'Selecione'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.client_id} value={c.client_id}>
                    Client #{c.client_id} — {c.queues_count} fila(s)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="include-sync"
              checked={includeSync}
              onCheckedChange={(v) => setIncludeSync(v === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="include-sync" className="text-sm font-normal">
                Incluir histórico de sincronização
              </Label>
              <p className="text-xs text-muted-foreground">
                Limpa também whatsapp_sync_jobs e logs relacionados.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <strong>Ação irreversível.</strong> Para confirmar, digite <code className="font-mono">RESETAR</code> abaixo.
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-text">Confirmação</Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite RESETAR"
              autoComplete="off"
            />
          </div>

          <div className="rounded-md border border-border p-3 space-y-2">
            <Label className="text-sm">Limpar mídias do chat (storage)</Label>
            <p className="text-xs text-muted-foreground">
              Remove todos os arquivos do bucket <code className="font-mono">chat-media</code>. Independente do escopo acima.
            </p>
            <Button variant="outline" size="sm" onClick={handleClearMedia} disabled={clearingMedia}>
              {clearingMedia && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Limpar mídias do chat
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canConfirm}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}