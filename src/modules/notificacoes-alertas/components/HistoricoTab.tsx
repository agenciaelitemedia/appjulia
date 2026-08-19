import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ALERT_TRIGGERS } from '../module';
import { useAlertHistory } from '../hooks/useAlertHistory';

const ALL = 'all';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Enviado',
  failed: 'Falhou',
  pending: 'Pendente',
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function HistoricoTab() {
  const [search, setSearch] = useState('');
  const [triggerKey, setTriggerKey] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [clientId, setClientId] = useState('');
  const [codAgent, setCodAgent] = useState('');

  const filters = useMemo(
    () => ({
      search: search || undefined,
      triggerKey: triggerKey === ALL ? undefined : triggerKey,
      status: status === ALL ? undefined : status,
      clientId: clientId.trim() || undefined,
      codAgent: codAgent.trim() || undefined,
    }),
    [search, triggerKey, status, clientId, codAgent],
  );

  const { data: entries = [], isLoading, isFetching, refetch } = useAlertHistory(filters);

  const triggerLabel = (key: string) =>
    ALERT_TRIGGERS.find((t) => t.key === key)?.label ?? key;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Histórico de disparos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Auditoria por escritório, agente, lead, gatilho, status e erro
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">Buscar (lead / destinatário)</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Nome ou WhatsApp"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Gatilho</Label>
            <Select value={triggerKey} onValueChange={setTriggerKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {ALERT_TRIGGERS.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Escritório (client_id)</Label>
            <Input
              placeholder="Todos"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Agente (cod_agent)</Label>
            <Input
              placeholder="Todos"
              value={codAgent}
              onChange={(e) => setCodAgent(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                <TableHead>Escritório</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Gatilho</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Carregando histórico...
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum disparo encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(entry.sent_at || entry.created_at)}
                    </TableCell>
                    <TableCell className="text-xs">{entry.client_id || '—'}</TableCell>
                    <TableCell className="text-xs">{entry.cod_agent}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{entry.lead_name || 'Não informado'}</div>
                      <div className="text-muted-foreground">{entry.lead_phone || '—'}</div>
                    </TableCell>
                    <TableCell className="text-xs">{triggerLabel(entry.trigger_key)}</TableCell>
                    <TableCell className="text-xs">{entry.recipient_phone}</TableCell>
                    <TableCell>
                      <Badge variant={entry.status === 'sent' ? 'default' : entry.status === 'failed' ? 'destructive' : 'secondary'}>
                        {STATUS_LABEL[entry.status] ?? entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] text-xs">
                      {entry.error_message ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 text-destructive truncate">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{entry.error_message}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              {entry.error_message}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}