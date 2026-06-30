import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeletePoolDevice, useRegisterPoolDevice, useUpdatePoolDevice, useWavoipDevices, type WavoipDevice } from '../hooks/useWavoipAdmin';
import { format } from 'date-fns';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

export function WavoipDevicesTab() {
  const { data: devices = [], isLoading } = useWavoipDevices();
  const register = useRegisterPoolDevice();
  const remove = useDeletePoolDevice();
  const update = useUpdatePoolDevice();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
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

  const handleRegister = () => {
    register.mutate(token, { onSuccess: () => { setToken(''); setOpen(false); } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Pool de dispositivos Wavoip</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Cadastrar dispositivo
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Conexão</TableHead>
              <TableHead>Visto em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (<TableRow><TableCell colSpan={7}>Carregando...</TableCell></TableRow>)}
            {!isLoading && devices.length === 0 && (<TableRow><TableCell colSpan={7} className="text-muted-foreground">Nenhum dispositivo cadastrado.</TableCell></TableRow>)}
            {devices.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.device_name ?? `WAPhone_${d.friendly_code ?? ''}`}</TableCell>
                <TableCell className="font-mono text-xs">{d.device_token.slice(0, 8)}…{d.device_token.slice(-4)}</TableCell>
                <TableCell>
                  <Badge variant={d.status === 'free' ? 'outline' : 'default'}>
                    {d.status === 'free' ? 'Livre' : 'Em uso'}
                  </Badge>
                </TableCell>
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
                    disabled={d.status === 'in_use'}
                    onClick={() => setDeleteTarget(d)}
                    title={d.status === 'in_use' ? 'Em uso — não pode ser removido' : 'Remover'}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cadastrar dispositivo Wavoip</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Token Wavoip *</Label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="cole o token do dispositivo criado no painel Wavoip" />
              <p className="text-xs text-muted-foreground mt-1">O nome (WAPhone_XXXX) será gerado automaticamente.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegister} disabled={!token.trim() || register.isPending}>
              {register.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar dispositivo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="WAPhone_XXXX" />
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