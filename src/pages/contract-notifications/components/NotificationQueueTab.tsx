import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Clock, Users, MessageSquare, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QueueItem {
  type: string;
  contract_cod_document: string;
  client_name: string;
  case_title: string;
  recipient_phone: string;
  step_number: number;
  step_title: string;
  estimated_at: string;
  message_preview: string;
  status_document: string;
}

interface NotificationQueueTabProps {
  codAgent: string;
}

export function NotificationQueueTab({ codAgent }: NotificationQueueTabProps) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['contract-notification-queue', codAgent],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('contract-notifications-queue', {
        body: { cod_agent: codAgent },
      });
      if (error) throw error;
      return (data?.queue || []) as QueueItem[];
    },
    enabled: !!codAgent,
  });

  const followupItems = data?.filter(i => i.type === 'LEAD_FOLLOWUP') || [];
  const officeItems = data?.filter(i => i.type === 'OFFICE_ALERT') || [];

  const renderTable = (items: QueueItem[], emptyMsg: string) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {emptyMsg}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contrato</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Destinatário</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Envio Estimado</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Preview</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => {
            const estimatedDate = new Date(item.estimated_at);
            const isPast = estimatedDate.getTime() <= Date.now();

            return (
              <TableRow key={`${item.contract_cod_document}-${item.recipient_phone}-${item.step_number}-${idx}`}>
                <TableCell className="font-mono text-xs">{item.contract_cod_document}</TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{item.client_name}</div>
                  <div className="text-xs text-muted-foreground">{item.case_title}</div>
                </TableCell>
                <TableCell className="text-sm">{item.recipient_phone}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{item.step_title}</div>
                  <div className="text-xs text-muted-foreground">Etapa {item.step_number}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {format(estimatedDate, "dd/MM HH:mm", { locale: ptBR })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isPast ? 'Pronto para envio' : formatDistanceToNow(estimatedDate, { locale: ptBR, addSuffix: true })}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={item.status_document === 'Assinado' ? 'default' : 'secondary'}>
                    {item.status_document}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <p className="text-xs text-muted-foreground truncate">{item.message_preview}</p>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Fila de Notificações</h3>
          <p className="text-sm text-muted-foreground">Envios programados para as próximas 24 horas</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            Followup de Leads
            <Badge variant="secondary" className="ml-auto">{followupItems.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderTable(followupItems, 'Nenhum followup programado nas próximas 24 horas')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-500" />
            Notificações do Escritório
            <Badge variant="secondary" className="ml-auto">{officeItems.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderTable(officeItems, 'Nenhuma notificação de escritório programada nas próximas 24 horas')}
        </CardContent>
      </Card>
    </div>
  );
}
