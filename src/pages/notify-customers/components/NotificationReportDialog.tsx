import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useNotificationReport } from '@/hooks/useNotificationReport';
import type { InternalNotification } from '@/hooks/useInternalNotifications';

export function NotificationReportDialog({ notification, onClose }: { notification: InternalNotification; onClose: () => void }) {
  const { data, isLoading } = useNotificationReport(notification.id);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Relatório — {notification.title}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">Enviados: {data.total}</Badge>
              <Badge variant="outline">Lidos: {data.readCount}</Badge>
              {notification.type !== 'message' && <Badge variant="outline">Responderam: {data.respondedCount}</Badge>}
            </div>

            {notification.type === 'poll' && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Resultado da enquete</p>
                {Object.keys(data.pollTally).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem respostas ainda.</p>
                ) : (
                  Object.entries(data.pollTally).map(([opt, count]) => (
                    <div key={opt} className="flex items-center justify-between text-sm border rounded px-3 py-1.5">
                      <span>{opt}</span>
                      <Badge>{count}</Badge>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="border rounded-md overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Lido</TableHead>
                    {notification.type === 'poll' && <TableHead>Escolha</TableHead>}
                    {notification.type === 'question' && <TableHead>Resposta</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recipients.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.user_name || r.user_id}</TableCell>
                      <TableCell className="text-xs">{r.user_role || '—'}</TableCell>
                      <TableCell className="text-xs">{r.read_at ? format(new Date(r.read_at), 'dd/MM HH:mm') : '—'}</TableCell>
                      {notification.type === 'poll' && <TableCell className="text-sm">{r.poll_choice || '—'}</TableCell>}
                      {notification.type === 'question' && <TableCell className="text-sm max-w-[280px] truncate" title={r.response_text ?? ''}>{r.response_text || '—'}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
