/**
 * Falhas de autenticação do conector MCP.
 *
 * Requisições recusadas com 401 nunca chegam ao dispatcher de ferramentas, por
 * isso não aparecem em cop_tool_calls. Aqui elas ficam visíveis com o motivo
 * classificado pelo servidor (sem expor o token), o que permite distinguir
 * "runtime sem token" de "token rotacionado/revogado/expirado".
 */
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, KeyRound, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '../extend/db';

interface AuthFailureRow {
  id: string;
  created_at: string;
  reason: string;
  path: string | null;
  method: string | null;
  token_hint: string | null;
  client_hint: string | null;
  detail: string | null;
}

const REASON_LABEL: Record<string, string> = {
  sem_bearer: 'Sem token na requisição',
  token_desconhecido: 'Token desconhecido',
  rotacionado: 'Token antigo (rotacionado)',
  revogado: 'Conexão revogada',
  expirado: 'Token expirado',
};

const REASON_TONE: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  sem_bearer: 'secondary',
  token_desconhecido: 'destructive',
  rotacionado: 'destructive',
  revogado: 'outline',
  expirado: 'outline',
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return iso;
  }
}

export function McpAuthFailuresCard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['mcp-auth-failures'],
    queryFn: async (): Promise<AuthFailureRow[]> => {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data, error } = await supabase
        .from('cop_auth_failures')
        .select('id, created_at, reason, path, method, token_hint, client_hint, detail')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AuthFailureRow[];
    },
    refetchInterval: 60_000,
  });

  const rows = data ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.reason] = (acc[r.reason] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Falhas de autenticação (7 dias)
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma requisição recusada nos últimos 7 dias. Quando o cliente MCP não envia o token, ou envia um token
            antigo, o motivo aparece aqui.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {Object.entries(counts).map(([reason, total]) => (
                <Badge key={reason} variant={REASON_TONE[reason] ?? 'secondary'}>
                  {REASON_LABEL[reason] ?? reason}: {total}
                </Badge>
              ))}
            </div>

            {counts.rotacionado ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <span>
                  Houve chamadas com token já substituído na renovação. O token anterior continua aceito por 5 minutos
                  após a troca; se o erro persistir, reconecte o servidor no cliente MCP para que o runtime receba o
                  token atual.
                </span>
              </div>
            ) : null}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Quando</TableHead>
                    <TableHead className="w-[190px]">Motivo</TableHead>
                    <TableHead className="w-[110px]">Token</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{fmt(r.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={REASON_TONE[r.reason] ?? 'secondary'}>
                          {REASON_LABEL[r.reason] ?? r.reason}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.token_hint ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.detail ?? '—'}
                        {r.client_hint ? <div className="opacity-70 mt-0.5 truncate">{r.client_hint}</div> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
