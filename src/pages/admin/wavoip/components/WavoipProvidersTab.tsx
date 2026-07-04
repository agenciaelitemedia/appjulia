import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, RefreshCw, Pencil, Trash2, Server, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  useWavoipProviders, useCreateWavoipProvider, useUpdateWavoipProvider,
  useDeleteWavoipProvider, useRefreshWavoipProviderToken, type WavoipProvider,
} from '../hooks/useWavoipProviders';

const TYPE_LABEL: Record<string, string> = {
  wavoip_multicanal: 'Wavoip Multicanal',
  wavoip_free: 'Wavoip Free',
};

const DEFAULT_API_BASE = 'https://api.wavoip.com';

interface FormState {
  id?: string;
  name: string;
  type: 'wavoip_multicanal' | 'wavoip_free';
  api_base: string;
  username: string;
  password: string;
}

const EMPTY: FormState = {
  name: '', type: 'wavoip_multicanal', api_base: DEFAULT_API_BASE, username: '', password: '',
};

export function WavoipProvidersTab() {
  const { data: providers = [], isLoading } = useWavoipProviders();
  const createMut = useCreateWavoipProvider();
  const updateMut = useUpdateWavoipProvider();
  const deleteMut = useDeleteWavoipProvider();
  const refreshMut = useRefreshWavoipProviderToken();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<WavoipProvider | null>(null);

  const isEditing = !!form.id;

  const openNew = () => { setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (p: WavoipProvider) => {
    setForm({ id: p.id, name: p.name, type: p.type, api_base: p.api_base, username: p.username, password: '' });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.name || !form.username || (!isEditing && !form.password)) {
      toast.error('Preencha nome, usuário e senha');
      return;
    }
    try {
      const res: any = isEditing
        ? await updateMut.mutateAsync({
            id: form.id!, name: form.name, type: form.type,
            api_base: form.api_base, username: form.username,
            password: form.password || undefined,
          })
        : await createMut.mutateAsync({
            name: form.name, type: form.type, api_base: form.api_base || DEFAULT_API_BASE,
            username: form.username, password: form.password,
          });
      if (res?.warning) toast.warning(res.warning);
      else toast.success(isEditing ? 'Provedor atualizado' : 'Provedor cadastrado e token salvo');
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar');
    }
  };

  const doRefresh = async (id: string) => {
    try {
      const res: any = await refreshMut.mutateAsync(id);
      if (res?.warning) toast.warning(res.warning);
      else toast.success('Token atualizado');
    } catch (e: any) { toast.error(e?.message ?? 'Falha ao atualizar token'); }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteMut.mutateAsync(toDelete.id);
      toast.success('Provedor removido');
      setToDelete(null);
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao remover'); }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Provedores Wavoip</h2>
            <p className="text-sm text-muted-foreground">
              Cadastre contas Wavoip. Ao salvar, o sistema faz login na Wavoip API e guarda o token.
            </p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Provedor
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : providers.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Nenhum provedor cadastrado</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>API Base</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Token</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <Badge variant={p.type === 'wavoip_multicanal' ? 'default' : 'secondary'}>
                    {TYPE_LABEL[p.type] ?? p.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.api_base}</TableCell>
                <TableCell className="text-sm">{p.username}</TableCell>
                <TableCell>
                  {p.last_login_status === 'ok' ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {p.token_updated_at ? format(new Date(p.token_updated_at), 'dd/MM/yy HH:mm') : 'OK'}
                    </div>
                  ) : p.last_login_status === 'error' ? (
                    <div className="flex items-center gap-1.5 text-destructive text-xs" title={p.last_login_error ?? ''}>
                      <XCircle className="h-3.5 w-3.5" /> Erro
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" title="Refazer login" onClick={() => doRefresh(p.id)} disabled={refreshMut.isPending}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Excluir" onClick={() => setToDelete(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar provedor' : 'Novo provedor Wavoip'}</DialogTitle>
            <DialogDescription>
              Ao salvar, o sistema chamará <code>POST /v2/login</code> na Wavoip API e guardará o token retornado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome do provedor</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Wavoip Principal" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wavoip_multicanal">Wavoip Multicanal</SelectItem>
                  <SelectItem value="wavoip_free">Wavoip Free</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="api_base">API Base</Label>
              <Input id="api_base" value={form.api_base} onChange={(e) => setForm({ ...form, api_base: e.target.value })} placeholder={DEFAULT_API_BASE} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Usuário (email)</Label>
              <Input id="username" type="email" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha {isEditing && <span className="text-xs text-muted-foreground">(deixe em branco para manter)</span>}</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {isEditing ? 'Salvar' : 'Cadastrar e fazer login'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover provedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{toDelete?.name}</strong>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}