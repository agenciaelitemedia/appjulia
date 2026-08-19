import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { maskPhone } from '../extend/masks';
import { useNoResponsePreview } from '../hooks/useNoResponsePreview';

interface Props {
  codAgent: string;
  minutes: number;
}

function fmtHour(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtDelta(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  const label = min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}min`;
  return diff > 0 ? `dispara em ${label}` : `já elegível há ${label}`;
}

export function NoResponsePreview({ codAgent, minutes }: Props) {
  const [debounced, setDebounced] = useState(minutes);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(minutes), 600);
    return () => clearTimeout(t);
  }, [minutes]);

  const { data = [], isLoading, isError, error } = useNoResponsePreview(codAgent, debounced);

  const eligible = data.filter((d) => d.eligible).length;
  const pending = data.length - eligible;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock className="h-4 w-4 text-muted-foreground" />
        Prévia — quem será considerado sem resposta
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando prévia…
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          Não foi possível carregar a prévia{(error as any)?.message ? `: ${(error as any).message}` : ''}.
        </div>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma conversa em silêncio nas últimas 48h para este agente.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Com {debounced} min, {eligible} conversa(s) já elegível(is) e {pending} aguardando o vencimento.
          </p>

          <div className="space-y-2">
            {data.slice(0, 8).map((item) => (
              <div
                key={item.conversationId}
                className="rounded-md border bg-background p-2.5 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.leadName}</p>
                    <p className="text-xs text-muted-foreground">{maskPhone(item.leadPhone)}</p>
                  </div>
                  <Badge
                    variant={item.eligible ? 'default' : 'secondary'}
                    className={item.eligible ? 'bg-amber-500 hover:bg-amber-500 text-xs' : 'text-xs'}
                  >
                    {item.eligible ? 'Já elegível' : 'Aguardando'}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Última mensagem considerada:</span>{' '}
                  {item.lastMessageFromMe ? 'Julia' : 'Lead'} · {fmtHour(item.lastMessageAt)} —{' '}
                  {item.lastMessagePreview}
                </p>

                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Vence em:</span>{' '}
                  {fmtHour(item.dueAt)} ({fmtDelta(item.dueAt)}) · último retorno do lead{' '}
                  {fmtHour(item.lastCustomerMessageAt)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        A prévia usa a mesma regra do disparo: janela máxima de 2 dias, conversas encerradas ignoradas e
        apenas conversas cuja última mensagem foi nossa.
      </p>
    </div>
  );
}
