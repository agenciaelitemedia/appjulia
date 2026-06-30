import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useDeletePoolDevice, useRegisterPoolDevice, useWavoipDevices } from '../hooks/useWavoipAdmin';
import { format } from 'date-fns';

export function WavoipDevicesTab() {
  const { data: devices = [], isLoading } = useWavoipDevices();
  const register = useRegisterPoolDevice();
  const remove = useDeletePoolDevice();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');

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
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={d.status === 'in_use'}
                    onClick={() => { if (confirm('Remover este dispositivo do pool?')) remove.mutate(d.id); }}
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
    </Card>
  );
}