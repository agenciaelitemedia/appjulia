import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2, Plus, Search, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEscritoriosPermissions } from '../extend/auth';
import { useEnsureEscritoriosModule } from '../extend/useEnsureEscritoriosModule';
import { useOffices, useOfficeMutations } from '../hooks/useOffices';
import { ESCRITORIOS_MODULE, ESCRITORIOS_ROUTES } from '../module';
import type { OfficeRecord } from '../types';
import { MascoteLoader } from "@/components/ui/mascote-loader";

export default function OfficesListPage() {
  useEnsureEscritoriosModule();
  const navigate = useNavigate();
  const permissions = useEscritoriosPermissions();
  const [search, setSearch] = useState('');
  const { data: offices = [], isLoading } = useOffices(search);
  const { updateOffice, deleteOffice } = useOfficeMutations();

  const [pendingDelete, setPendingDelete] = useState<OfficeRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!permissions.canView) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Você não tem permissão para ver os escritórios.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Building2 className="h-6 w-6 text-primary" /> Listar Escritórios
          </h1>
          <p className="text-sm text-muted-foreground">{ESCRITORIOS_MODULE.description}</p>
        </div>
        {permissions.canCreate && (
          <Button className="rounded-full" onClick={() => navigate(ESCRITORIOS_ROUTES.create)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Escritório
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Buscar por escritório, titular ou documento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <MascoteLoader size="xs" />
            </div>
          ) : offices.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Nenhum escritório cadastrado</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Cadastre escritórios que operam apenas com chat, CRM e telefonia — sem agente da Julia.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escritório</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Módulos</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offices.map((office) => (
                  <TableRow key={office.id}>
                    <TableCell>
                      <div className="font-medium">{office.office_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {office.business_name || office.email || `Cliente #${office.client_id}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{office.owner_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{office.owner_email || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{office.plan_name || (office.plan_id ? `Plano #${office.plan_id}` : '—')}</div>
                      <div className="text-xs text-muted-foreground">
                        {office.leads_limit ? `${office.leads_limit} leads` : 'Sem limite'}
                        {office.due_day ? ` · vence dia ${office.due_day}` : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{office.modules?.length || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={office.is_active}
                        disabled={!permissions.canEdit}
                        onCheckedChange={(checked) =>
                          updateOffice.mutate({ id: office.id, patch: { is_active: checked } })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-full"
                          onClick={() => navigate(ESCRITORIOS_ROUTES.details(office.id))}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {permissions.canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-full text-destructive"
                            onClick={() => {
                              setPendingDelete(office);
                              setConfirmDelete(false);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover escritório da listagem?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro <strong>{pendingDelete?.office_name}</strong> sai desta listagem. O cliente e o
              usuário continuam existindo no sistema e mantêm suas permissões.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Switch id="confirm-delete-office" checked={confirmDelete} onCheckedChange={setConfirmDelete} />
            <Label htmlFor="confirm-delete-office" className="text-sm">
              Confirmo a remoção deste escritório
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              disabled={!confirmDelete}
              onClick={() => {
                if (pendingDelete) deleteOffice.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}