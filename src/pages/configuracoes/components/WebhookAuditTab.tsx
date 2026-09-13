import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, ShieldCheck, Wrench, History, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface AuditRow {
  queue_id: string;
  name: string;
  client_id: number | null;
  instance: string | null;
  status: 'ok' | 'precisa_corrigir' | 'sem_credenciais' | 'erro_provedor';
  current_url?: string | null;
  expected_url?: string;
  url_ok?: boolean;
  enabled?: boolean | null;
  events?: string[];
  missing_events?: string[];
  needs_fix?: boolean;
  error?: string;
  http_status?: number;
}

const STATUS_LABEL: Record<AuditRow['status'], string> = {
  ok: 'OK',
  precisa_corrigir: 'Precisa corrigir',
  sem_credenciais: 'Sem credenciais',
  erro_provedor: 'Erro no provedor',
};

export function WebhookAuditTab() {
  const [loading, setLoading] = useState(false);
  const [fixingAll, setFixingAll] = useState(false);
  const [busyQueue, setBusyQueue] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [expectedEvents, setExpectedEvents] = useState<string[]>([]);
  const [lastEvents, setLastEvents] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const loadLastEvents = async () => {
    const { data } = await supabase
      .from('chat_inbound_queue')
      .select('queue_id, created_at')
      .order('created_at', { ascending: false })
      .limit(2000);
    const map: Record<string, string> = {};
    for (const r of data ?? []) {
      const qid = (r as { queue_id: string | null }).queue_id;
      const created = (r as { created_at: string }).created_at;
      if (qid && !map[qid]) map[qid] = created;
    }
    setLastEvents(map);
  };

  const runAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-instance-manager', {
        body: { action: 'audit_webhooks' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRows((data?.results ?? []) as AuditRow[]);
      setExpectedEvents((data?.expected_events ?? []) as string[]);
      await loadLastEvents();
      toast.success(`Auditoria concluída: ${data?.needs_fix ?? 0} de ${data?.total ?? 0} precisam de correção`);
    } catch (err) {
      toast.error(`Falha na auditoria: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const fixOne = async (queueId: string) => {
    setBusyQueue(queueId);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-instance-manager', {
        body: { action: 'reconfigure_webhook', queue_id: queueId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Webhook reconfigurado');
      await runAudit();
    } catch (err) {
      toast.error(`Falha ao corrigir: ${(err as Error).message}`);
    } finally {
      setBusyQueue(null);
    }
  };

  const restoreHistory = async (queueId: string) => {
    setBusyQueue(queueId);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-history-force-resync', {
        body: { queue_id: queueId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Restauração de histórico solicitada. Acompanhe na aba History UaZapi.');
    } catch (err) {
      toast.error(`Falha ao restaurar histórico: ${(err as Error).message}`);
    } finally {
      setBusyQueue(null);
    }
  };

  const fixAll = async () => {
    setFixingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-instance-manager', {
        body: { action: 'reconfigure_webhook_all' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Reconfiguradas ${data?.ok ?? 0} de ${data?.total ?? 0} conexões`);
      await runAudit();
    } catch (err) {
      toast.error(`Falha ao corrigir todas: ${(err as Error).message}`);
    } finally {
      setFixingAll(false);
    }
  };

  const filtered = (rows ?? [])
    .filter((r) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        (r.name || '').toLowerCase().includes(term) ||
        String(r.client_id ?? '').includes(term) ||
        (r.instance || '').toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (!!a.needs_fix !== !!b.needs_fix) return a.needs_fix ? -1 : 1;
      return (a.client_id ?? 0) - (b.client_id ?? 0);
    });

  const needFix = (rows ?? []).filter((r) => r.needs_fix).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Auditoria de webhook das conexões WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Consulta cada conexão por QR Code ativa no provedor e compara o endereço de retorno e os
            avisos assinados com o esperado
            {expectedEvents.length > 0 ? `: ${expectedEvents.join(', ')}` : ''}.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runAudit} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Rodar auditoria
            </Button>
            <Button
              variant="secondary"
              onClick={fixAll}
              disabled={fixingAll || loading || needFix === 0}
              className="gap-2"
            >
              {fixingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              Corrigir todas
            </Button>
            <Input
              placeholder="Filtrar por nome, escritório ou instância"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {rows && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">Total: {rows.length}</Badge>
              <Badge variant="outline" className="text-green-600">OK: {rows.length - needFix}</Badge>
              <Badge variant={needFix > 0 ? 'destructive' : 'outline'}>Precisam corrigir: {needFix}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {rows && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60">
                  <tr className="text-left">
                    <th className="p-3">Escritório</th>
                    <th className="p-3">Conexão</th>
                    <th className="p-3">Situação</th>
                    <th className="p-3">Avisos faltando</th>
                    <th className="p-3">Último evento</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.queue_id} className="border-t align-top">
                      <td className="p-3 whitespace-nowrap">{r.client_id ?? '—'}</td>
                      <td className="p-3">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.instance}</div>
                        {r.needs_fix && r.url_ok === false && (
                          <div className="text-xs text-destructive">Endereço de retorno diferente do esperado</div>
                        )}
                        {r.enabled === false && (
                          <div className="text-xs text-destructive">Webhook desligado</div>
                        )}
                        {r.error && <div className="text-xs text-destructive">{r.error}</div>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <Badge variant={r.needs_fix ? 'destructive' : 'outline'} className="gap-1">
                          {r.needs_fix && <AlertTriangle className="h-3 w-3" />}
                          {STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {r.missing_events && r.missing_events.length > 0
                          ? r.missing_events.join(', ')
                          : '—'}
                      </td>
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                        {lastEvents[r.queue_id]
                          ? new Date(lastEvents[r.queue_id]).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                          : 'sem eventos recentes'}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={busyQueue === r.queue_id}
                            onClick={() => fixOne(r.queue_id)}
                          >
                            {busyQueue === r.queue_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wrench className="h-3 w-3" />
                            )}
                            Corrigir
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            disabled={busyQueue === r.queue_id}
                            onClick={() => restoreHistory(r.queue_id)}
                          >
                            <History className="h-3 w-3" />
                            Restaurar histórico
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        Nenhuma conexão encontrada com esse filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
