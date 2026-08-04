import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Trash2, Workflow, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useFlows, useFlowMutations, type FlowSummary } from '../hooks/useFlows';
import { useFlowBuilderPermissions } from '../extend/auth';
import { useEnsureFlowBuilderModule } from '../extend/useEnsureFlowBuilderModule';
import { FLOW_BUILDER_MODULE, FLOW_BUILDER_ROUTES } from '../module';

export default function FlowListPage() {
  useEnsureFlowBuilderModule();
  const navigate = useNavigate();
  const permissions = useFlowBuilderPermissions();
  const { data: flows = [], isLoading } = useFlows();
  const { createFlow, deleteFlow } = useFlowMutations();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [pendingDelete, setPendingDelete] = useState<FlowSummary | null>(null);

  const handleCreate = async () => {
    const created = await createFlow.mutateAsync({ name: newName.trim() || 'Nova automação', description: newDescription });
    setCreateOpen(false);
    setNewName('');
    setNewDescription('');
    navigate(FLOW_BUILDER_ROUTES.editor(created.id));
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Workflow className="h-6 w-6 text-flow-trigger" /> {FLOW_BUILDER_MODULE.name}
          </h1>
          <p className="text-sm text-muted-foreground">{FLOW_BUILDER_MODULE.description}</p>
        </div>
        {permissions.canCreate && (
          <Button className="rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova automação
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : flows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Zap className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nenhuma automação criada</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Monte fluxos visuais para responder leads, etiquetar conversas, mover cards no CRM e acionar a Julia.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Card
              key={flow.id}
              className="cursor-pointer transition-colors hover:border-ring"
              onClick={() => navigate(FLOW_BUILDER_ROUTES.editor(flow.id))}
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate font-medium">{flow.name}</p>
                  <Badge
                    variant="outline"
                    className={
                      flow.status === 'published'
                        ? 'border-emerald-500/40 text-emerald-600'
                        : flow.status === 'archived'
                          ? 'border-muted text-muted-foreground'
                          : 'border-amber-500/40 text-amber-600'
                    }
                  >
                    {flow.status === 'published'
                      ? `Publicada${flow.published_version ? ` v${flow.published_version}` : ''}`
                      : flow.status === 'archived'
                        ? 'Arquivada'
                        : 'Rascunho'}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {flow.description || 'Sem descrição'}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{flow.nodes.length} bloco(s) · {flow.execution_count} execução(ões)</span>
                  {permissions.canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-full text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(flow);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova automação</DialogTitle>
            <DialogDescription>Dê um nome ao fluxo. Você monta os blocos no próximo passo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Boas-vindas de novos leads" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
              <Textarea rows={3} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createFlow.isPending}>
              {createFlow.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar e abrir editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A automação e todos os seus blocos serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) deleteFlow.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}