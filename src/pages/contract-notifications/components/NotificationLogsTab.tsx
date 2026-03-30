import { RefreshCw, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { useContractNotificationLogs } from '@/hooks/useContractNotificationConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface NotificationLogsTabProps {
  codAgent: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  sent: { label: 'Enviado', className: 'bg-green-500/15 text-green-700 border-green-300' },
  failed: { label: 'Falhou', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  pending: { label: 'Pendente', className: 'bg-yellow-500/15 text-yellow-700 border-yellow-300' },
};

const typeConfig: Record<string, { label: string; className: string }> = {
  LEAD_FOLLOWUP: { label: 'Followup', className: 'bg-blue-500/15 text-blue-700 border-blue-300' },
  OFFICE_ALERT: { label: 'Escritório', className: 'bg-purple-500/15 text-purple-700 border-purple-300' },
};

export function NotificationLogsTab({ codAgent }: NotificationLogsTabProps) {
  const { data: logs, isLoading } = useContractNotificationLogs(codAgent);
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['contract-notification-logs', codAgent] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg">Histórico de Envios</CardTitle>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : !logs || logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Inbox className="h-10 w-10" />
            <p>Nenhum envio registrado</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const status = statusConfig[log.status] || statusConfig.pending;
                  const type = typeConfig[log.type || ''] || { label: log.type || '-', className: '' };

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {log.created_at
                          ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={type.className}>
                          {type.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {log.contract_cod_document || '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.recipient_phone || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.step_number || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                        {log.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
