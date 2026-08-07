import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Settings2, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import { XJLayout } from '../components/XJLayout';
import { useXJAgentMutations, useXJAgents } from '../hooks/useXJAgents';
import { useXJPermissions } from '../extend/auth';
import { X_JULIA_ROUTES } from '../module';

export default function XJAgentsPage() {
  const { data: agents = [], isLoading } = useXJAgents();
  const { create, update, remove } = useXJAgentMutations();
  const permissions = useXJPermissions();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('X-Julia');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const handleCreate = async () => {
    const agent = await create.mutateAsync({ name });
    setCreating(false);
    setName('X-Julia');
    if (agent?.id) window.location.assign(X_JULIA_ROUTES.agent(agent.id));
  };

  return (
    <XJLayout
      title="Agentes X-Julia"
      description="Cada agente tem prompt, LLM, voz, casos e followups próprios"
      actions={
        permissions.canCreate && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo agente
          </Button>
        )
      }
    >
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhum agente criado ainda.</p>
            {permissions.canCreate && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Criar agente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{agent.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {agent.llm_provider} · {agent.llm_model}
                    </p>
                  </div>
                  <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                    {agent.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>

                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {agent.persona || 'Sem persona configurada.'}
                </p>

                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {agent.voice_enabled && <Badge variant="outline">Voz: {agent.voice_provider}</Badge>}
                  <Badge variant="outline">Contrato: {agent.contract_provider}</Badge>
                  {agent.mirror_to_crm_builder && <Badge variant="outline">Espelha CRM</Badge>}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={agent.is_active}
                      disabled={!permissions.canEdit}
                      onCheckedChange={(is_active) => update.mutate({ id: agent.id, patch: { is_active } })}
                    />
                    <span className="text-xs text-muted-foreground">Ativo</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <Link to={X_JULIA_ROUTES.agent(agent.id)}>
                        <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Configurar
                      </Link>
                    </Button>
                    {permissions.canDelete && (
                      <Button
                        size="icon"
                        variant="outline"
                        className="rounded-full text-destructive"
                        onClick={() => {
                          setConfirmDelete(agent.id);
                          setConfirmChecked(false);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agente X-Julia</DialogTitle>
            <DialogDescription>Você configura prompt, LLM, voz e followups na próxima tela.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome do agente</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="X-Julia" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || create.isPending}>
              Criar agente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente</AlertDialogTitle>
            <AlertDialogDescription>
              Sessões, followups e cadências deste agente serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Switch checked={confirmChecked} onCheckedChange={setConfirmChecked} />
            <span className="text-sm">Confirmo a exclusão definitiva deste agente</span>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmChecked}
              onClick={() => {
                if (confirmDelete) remove.mutate(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </XJLayout>
  );
}