import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { useDeletePoolDevice, useUpdatePoolDevice, useWavoipDevices, type WavoipDevice } from '../hooks/useWavoipAdmin';
import { format } from 'date-fns';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

export function WavoipDevicesTab() {
  const { data: devices = [], isLoading } = useWavoipDevices();
  const remove = useDeletePoolDevice();
  const update = useUpdatePoolDevice();
  const [editTarget, setEditTarget] = useState<WavoipDevice | null>(null);
  const [editName, setEditName] = useState('');
  const [editToken, setEditToken] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WavoipDevice | null>(null);

  const startEdit = (d: WavoipDevice) => {
    setEditTarget(d);
    setEditName(d.device_name ?? '');
    setEditToken('');
  };

  const saveEdit = () => {
    if (!editTarget) return;
    update.mutate(
      { id: editTarget.id, device_name: editName, device_token: editToken || undefined },
      { onSuccess: () => setEditTarget(null) }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dispositivos Wavoip</CardTitle>
        <p className="text-xs text-muted-foreground">
          Dispositivos são criados automaticamente quando um cliente é ativado em um plano Wavoip.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Wavoip ID</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Conexão</TableHead>
              <TableHead>Visto em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (<TableRow><TableCell colSpan={7}>Carregando...</TableCell></TableRow>)}
            {!isLoading && devices.length === 0 && (<TableRow><TableCell colSpan={7} className="text-muted-foreground">Nenhum dispositivo criado ainda.</TableCell></TableRow>)}
            {devices.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.device_name ?? '-'}</TableCell>
                <TableCell className="font-mono text-xs">{d.wavoip_device_id ?? '-'}</TableCell>
                <TableCell className="font-mono text-xs">{d.device_token.slice(0, 8)}…{d.device_token.slice(-4)}</TableCell>
                <TableCell className="font-mono text-xs">{d.client_id ?? '-'}</TableCell>
                <TableCell>
                  <Badge variant={d.connection_status === 'connected' ? 'default' : 'outline'}>
                    {d.connection_status}
                  </Badge>
                </TableCell>
                <TableCell>{d.last_seen_at ? format(new Date(d.last_seen_at), 'dd/MM HH:mm') : '-'}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(d)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteTarget(d)}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar dispositivo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Substituir token (opcional)</Label>
              <Input value={editToken} onChange={(e) => setEditToken(e.target.value)} placeholder="deixe vazio para manter o token atual" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={update.isPending || !editName.trim()}>
              {update.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Remover dispositivo do pool?"
        description={<>O dispositivo <strong>{deleteTarget?.device_name}</strong> será removido permanentemente do pool Wavoip.</>}
        toggleLabel="Confirmo a remoção deste dispositivo do pool"
        loading={remove.isPending}
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </Card>
  );
}