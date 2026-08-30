/**
 * Drill-down de uma chamada do MCP pelo request_id: cobertura, erro tipado,
 * latência e resumo redigido dos argumentos (sem conteúdo de lead).
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMcpCallDetail } from '../hooks/useMcpTelemetry';

const fmt = (iso?: string | null) =>
  !iso
    ? '—'
    : new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-right break-all">{children}</span>
    </div>
  );
}

export function McpCallDetailSheet({
  requestId,
  onOpenChange,
}: {
  requestId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: call, isLoading } = useMcpCallDetail(requestId);

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };

  return (
    <Sheet open={!!requestId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Detalhe da chamada</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : !call ? (
          <p className="text-sm text-muted-foreground py-8">Chamada não encontrada neste escritório.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={call.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px]">
                {call.status === 'error' ? call.error_code || 'ERRO' : 'ok'}
              </Badge>
              {call.mode === 'write' && <Badge variant="outline" className="text-[10px]">escrita</Badge>}
              {call.dry_run === true && <Badge variant="outline" className="text-[10px]">dry-run</Badge>}
              {call.coverage_complete === false && (
                <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
                  cobertura incompleta
                </Badge>
              )}
              {call.retryable && <Badge variant="outline" className="text-[10px]">retentável</Badge>}
            </div>

            <div className="rounded-md border p-3">
              <Row label="request_id">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-mono hover:text-primary"
                  onClick={() => copy(call.request_id, 'request_id')}
                >
                  {call.request_id}
                  <Copy className="h-3 w-3" />
                </button>
              </Row>
              <Row label="Ferramenta"><span className="font-mono">{call.tool_name}</span></Row>
              <Row label="Domínio">{call.domain || '—'}</Row>
              <Row label="Versão da tool">{call.tool_version || '—'}</Row>
              <Row label="Latência">{call.latency_ms} ms</Row>
              <Row label="Resultados">{call.result_count ?? '—'}</Row>
              <Row label="Avisos de cobertura">{call.coverage_warnings ?? 0}</Row>
              <Row label="Dependência">{call.dependency || '—'}</Row>
              <Row label="Horário (Brasília)">{fmt(call.created_at)}</Row>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium">Resumo redigido dos argumentos</p>
                {call.arg_summary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => copy(JSON.stringify(call.arg_summary, null, 2), 'JSON')}
                  >
                    <Copy className="h-3 w-3" /> Copiar JSON
                  </Button>
                )}
              </div>
              <pre className="text-[11px] bg-muted rounded-md p-3 overflow-auto max-h-64">
                {call.arg_summary
                  ? JSON.stringify(call.arg_summary, null, 2)
                  : (call.arg_keys || []).length
                    ? `chaves: ${(call.arg_keys || []).join(', ')}`
                    : 'Sem argumentos registrados.'}
              </pre>
              <p className="text-[11px] text-muted-foreground mt-1">
                Conteúdo de lead, mídia e credenciais nunca são gravados na telemetria.
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
