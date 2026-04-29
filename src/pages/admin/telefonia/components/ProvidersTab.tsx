import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react';
import { useTelephonyProviders, useDeleteTelephonyProvider, type TelephonyProvider } from '../hooks/useTelephonyProviders';
import { ProviderDialog } from './ProviderDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function ProvidersTab() {
  const { data: providers = [], isLoading } = useTelephonyProviders();
  const del = useDeleteTelephonyProvider();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TelephonyProvider | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(p: TelephonyProvider) { setEditing(p); setDialogOpen(true); }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Provedores de Telefonia</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Pool de provedores. O marcado como <strong>padrão</strong> é usado nas contratações automáticas.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo provedor</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : providers.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum provedor cadastrado. Adicione um para liberar contratações automáticas.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>URL Principal</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.provider === 'api4com' ? 'Api4Com' : '3C+'}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[260px]">
                    {p.api4com_domain || p.threecplus_base_url || '—'}
                  </TableCell>
                  <TableCell>
                    {p.is_default ? <Badge className="gap-1"><Star className="h-3 w-3" /> Padrão</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Ativo' : 'Inativo'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} provider={editing} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover provedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o provedor do pool. Configurações já criadas em "Configurações por Agente" não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteId) await del.mutateAsync(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
