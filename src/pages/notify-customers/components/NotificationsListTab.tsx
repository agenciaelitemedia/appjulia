import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import { useInternalNotifications, type InternalNotification } from '@/hooks/useInternalNotifications';
import { NotificationReportDialog } from './NotificationReportDialog';

const TYPE_LABEL: Record<string, string> = { message: 'Mensagem', poll: 'Enquete', question: 'Pergunta' };
const AUDIENCE_LABEL: Record<string, string> = { all: 'Todos', owners: 'Donos', teams: 'Equipes', my_team: 'Minha Equipe' };
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  sent: 'default', scheduled: 'secondary', sending: 'secondary', draft: 'outline', failed: 'destructive', canceled: 'outline',
};

export function NotificationsListTab() {
  const { notifications, isLoading } = useInternalNotifications();
  const [selected, setSelected] = useState<InternalNotification | null>(null);

  const previewNotification = (n: InternalNotification) => {
    window.dispatchEvent(new CustomEvent('internal-notification:test', {
      detail: {
        title: n.title,
        body: n.body ?? null,
        type: n.type,
        poll_options: n.poll_options ?? null,
        alert_level: n.alert_level ?? 'info',
      },
    }));
  };

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  if (notifications.length === 0) {
    return <div className="text-center text-muted-foreground py-12 border rounded-md">Nenhuma notificação criada ainda.</div>;
  }

  return (
    <>
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Público</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead className="text-right">Destinatários</TableHead>
              <TableHead className="text-right">Relatório</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((n) => (
              <TableRow
                key={n.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => previewNotification(n)}
                role="button"
              >
                <TableCell className="font-medium max-w-[240px] truncate">{n.title}</TableCell>
                <TableCell className="text-xs">{TYPE_LABEL[n.type] ?? n.type}</TableCell>
                <TableCell className="text-xs">{AUDIENCE_LABEL[n.audience] ?? n.audience}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[n.status] ?? 'outline'} className="text-[10px]">{n.status}</Badge></TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {n.sent_at ? format(new Date(n.sent_at), 'dd/MM/yyyy HH:mm')
                    : n.scheduled_for ? `agendado: ${format(new Date(n.scheduled_for), 'dd/MM HH:mm')}` : '—'}
                </TableCell>
                <TableCell className="text-right">{n.recipients_total}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setSelected(n); }}
                    disabled={n.status !== 'sent'}
                  >
                    <BarChart2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <NotificationReportDialog notification={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
