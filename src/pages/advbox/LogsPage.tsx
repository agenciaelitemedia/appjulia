import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotificationLogs, NotificationLogsFilters } from '@/hooks/advbox/useNotificationLogs';
import { AdvboxAgentSelect } from '@/components/advbox/AdvboxAgentSelect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Bell,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { NotificationStatus } from '@/types/advbox';

export default function AdvboxLogsPage() {
  const { logs, total, isLoading, isResending, loadLogs, resendNotification } = useNotificationLogs();
  const [selectedCodAgent, setSelectedCodAgent] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<NotificationLogsFilters>({
    page: 1,
    limit: 20,
  });

  useEffect(() => {
    if (selectedCodAgent) {
      loadLogs(selectedCodAgent, filters);
    }
  }, [selectedCodAgent, filters, loadLogs]);

  const handleFilterChange = (key: keyof NotificationLogsFilters, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
      page: 1, // Reset to first page on filter change
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleResend = async (logId: string) => {
    if (!selectedCodAgent) return;
    await resendNotification(logId, selectedCodAgent);
    await loadLogs(selectedCodAgent, filters);
  };

  const toggleRowExpanded = (logId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: NotificationStatus) => {
    switch (status) {
      case 'sent':
        return (
          <Badge variant="default" className="bg-primary">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Enviada
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Falha
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalPages = Math.ceil(total / (filters.limit || 20));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/advbox">
            <ChevronLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Histórico de Notificações</h1>
            <p className="text-muted-foreground">Visualize e gerencie notificações enviadas</p>
          </div>
        </div>
      </div>

      {/* Agent Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecionar Agente</CardTitle>
        </CardHeader>
        <CardContent>
          <AdvboxAgentSelect
            value={selectedCodAgent}
            onValueChange={setSelectedCodAgent}
            placeholder="Selecione um agente..."
          />
        </CardContent>
      </Card>

      {selectedAgentId && (
        <>
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-4 h-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Select
                    value={filters.status || 'all'}
                    onValueChange={(value) => handleFilterChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="sent">Enviadas</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="failed">Com falha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    type="date"
                    placeholder="Data inicial"
                    value={filters.start_date || ''}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    type="date"
                    placeholder="Data final"
                    value={filters.end_date || ''}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Telefone"
                    value={filters.recipient_phone || ''}
                    onChange={(e) => handleFilterChange('recipient_phone', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Logs de Notificações</CardTitle>
                <CardDescription>{total} registros encontrados</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedAgentId && loadLogs(selectedAgentId, filters)}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma notificação encontrada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Data</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Regra</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <Collapsible key={log.id} asChild open={expandedRows.has(log.id)}>
                        <>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleRowExpanded(log.id)}
                                >
                                  {expandedRows.has(log.id) ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell>
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.recipient_phone}
                            </TableCell>
                            <TableCell>{log.rule_name || '—'}</TableCell>
                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                            <TableCell className="text-right">
                              {log.status === 'failed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResend(log.id)}
                                  disabled={isResending}
                                >
                                  {isResending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-4 h-4" />
                                  )}
                                  <span className="ml-1 hidden sm:inline">Reenviar</span>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={6} className="p-4">
                                <div className="space-y-2">
                                  <div>
                                    <strong className="text-sm">Mensagem:</strong>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                                      {log.message_text}
                                    </p>
                                  </div>
                                  {log.error_message && (
                                    <div>
                                      <strong className="text-sm text-destructive">Erro:</strong>
                                      <p className="text-sm text-destructive/80 mt-1">
                                        {log.error_message}
                                      </p>
                                    </div>
                                  )}
                                  {log.sent_at && (
                                    <p className="text-xs text-muted-foreground">
                                      Enviado em: {format(new Date(log.sent_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {filters.page} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange((filters.page || 1) - 1)}
                      disabled={(filters.page || 1) <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange((filters.page || 1) + 1)}
                      disabled={(filters.page || 1) >= totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* No Agent Selected */}
      {!selectedAgentId && (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Selecione um Agente</h3>
            <p className="text-muted-foreground">
              Escolha um agente acima para visualizar o histórico de notificações
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
