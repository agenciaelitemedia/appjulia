import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Archive, ArchiveRestore, Eye, Filter, PencilLine, Plus, Trash2, Upload, Users } from 'lucide-react';
import {
  useDeleteAudience,
  useDspAudiences,
  useUpdateAudience,
} from '../hooks/useDspAudiences';
import type { DspAudience } from '../types';
import { AudienceDetailsDialog } from './AudienceDetailsDialog';
import { AudienceWizardDialog } from './AudienceWizardDialog';

const SOURCE_META: Record<string, { label: string; icon: any }> = {
  csv: { label: 'CSV', icon: Upload },
  manual: { label: 'Manual', icon: PencilLine },
  filter: { label: 'Filtro da Julia', icon: Filter },
};

interface Props {
  clientId: string | null;
  canEdit: boolean;
}

export function PublicoTab({ clientId, canEdit }: Props) {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selected, setSelected] = useState<DspAudience | null>(null);

  const { data: audiences = [], isLoading } = useDspAudiences(clientId, showArchived);
  const updateAudience = useUpdateAudience();
  const deleteAudience = useDeleteAudience();

  const filtered = audiences.filter((a) =>
    a.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar público"
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          Incluir arquivados
        </label>
        <div className="ml-auto">
          {canEdit && (
            <Button onClick={() => setWizardOpen(true)} className="rounded-full">
              <Plus className="mr-2 h-4 w-4" />
              Novo público
            </Button>
          )}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando públicos...</p>}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum público criado. Monte grupos de contatos por CSV, manualmente ou por filtros da Julia.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((a) => {
          const meta = SOURCE_META[a.source] ?? { label: a.source, icon: Users };
          const Icon = meta.icon;
          const archived = a.status === 'archived';
          return (
            <Card key={a.id} className={archived ? 'opacity-70' : undefined}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{a.name}</CardTitle>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                </div>
                {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    {a.total_active.toLocaleString('pt-BR')} ativos
                  </Badge>
                  {a.total_removed > 0 && <Badge variant="outline">{a.total_removed} removidos</Badge>}
                  {archived && <Badge variant="secondary">arquivado</Badge>}
                </div>
                {a.last_synced_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Sincronizado em {new Date(a.last_synced_at).toLocaleString('pt-BR')}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setSelected(a)}
                  >
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    Detalhes
                  </Button>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() =>
                        updateAudience.mutate({
                          id: a.id,
                          patch: { status: archived ? 'active' : 'archived' } as any,
                        })
                      }
                    >
                      {archived ? (
                        <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                      ) : (
                        <Archive className="mr-2 h-3.5 w-3.5" />
                      )}
                      {archived ? 'Reativar' : 'Arquivar'}
                    </Button>
                  )}
                  {canEdit && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir público?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Públicos já usados em campanhas não podem ser excluídos — nesse caso, arquive.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteAudience.mutate(a.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AudienceWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} clientId={clientId} />
      <AudienceDetailsDialog
        audience={selected}
        onOpenChange={(v) => !v && setSelected(null)}
        canEdit={canEdit}
      />
    </div>
  );
}
