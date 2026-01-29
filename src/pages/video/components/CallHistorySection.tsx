import { History, Phone, Clock, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCallHistory, type CallHistoryRecord } from '../hooks/useCallHistory';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CallHistorySectionProps {
  expanded?: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), "dd/MM HH:mm", { locale: ptBR });
  } catch {
    return '-';
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge variant="default">Finalizada</Badge>;
    case 'active':
      return <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">Em andamento</Badge>;
    case 'pending':
      return <Badge variant="secondary">Aguardando</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatWhatsApp(number: string | null): string {
  if (!number) return '-';
  const clean = number.replace(/\D/g, '');
  if (clean.length === 13) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return number;
}

export function CallHistorySection({ expanded = false }: CallHistorySectionProps) {
  const { isAdmin } = useAuth();
  const limit = expanded ? 100 : 20;
  const { data: records = [], isLoading } = useCallHistory(limit);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Chamadas
          {records.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {records.length}
            </Badge>
          )}
          {isAdmin && (
            <Badge variant="outline" className="ml-auto text-xs">
              Todos os operadores
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="font-medium">Nenhuma chamada registrada</p>
            <p className="text-sm mt-1">O histórico aparecerá aqui após a primeira chamada</p>
          </div>
        ) : (
          <ScrollArea className={expanded ? 'max-h-[calc(100vh-300px)]' : 'max-h-[300px]'}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-sm">
                      {formatDateTime(record.started_at || record.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[120px]">
                          {record.operator_name || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="truncate max-w-[120px]">
                        {record.contact_name || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-xs">
                          {formatWhatsApp(record.whatsapp_number)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatDuration(record.duration_seconds)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(record.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
