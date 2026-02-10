import { useState } from 'react';
import { Plus, Upload, Eye, EyeOff, Trash2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useMonitoredProcesses } from '../hooks/useMonitoredProcesses';
import { AlertsPanel } from './AlertsPanel';
import { AddProcessDialog } from './AddProcessDialog';
import { BulkImportDialog } from './BulkImportDialog';

export function MonitoringTab() {
  const { processes, isLoading, toggleStatus, removeProcess } = useMonitoredProcesses();
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <div className="space-y-6">
      <AlertsPanel />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Processo
        </Button>
        <Button variant="outline" onClick={() => setBulkOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Importar Lista
        </Button>
      </div>

      {/* Process List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : processes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Eye className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium mb-1">Nenhum processo monitorado</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Adicione processos para monitorar movimentações automaticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Processo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tel. Cliente</TableHead>
                <TableHead>Tribunal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última Verificação</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processes.map((proc) => (
                <TableRow key={proc.id}>
                  <TableCell className="font-mono text-xs">
                    {proc.process_number_formatted}
                  </TableCell>
                  <TableCell className="text-sm">{proc.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {proc.client_phone || '-'}
                  </TableCell>
                  <TableCell>
                    {proc.tribunal ? (
                      <Badge variant="outline" className="text-xs">{proc.tribunal}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={proc.status === 'active' ? 'default' : proc.status === 'paused' ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {proc.status === 'active' ? 'Ativo' : proc.status === 'paused' ? 'Pausado' : 'Erro'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {proc.last_check_at
                      ? new Date(proc.last_check_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : 'Nunca'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleStatus.mutate({
                          id: proc.id,
                          status: proc.status === 'active' ? 'paused' : 'active',
                        })}
                      >
                        {proc.status === 'active' ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeProcess.mutate(proc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AddProcessDialog open={addOpen} onOpenChange={setAddOpen} />
      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}
