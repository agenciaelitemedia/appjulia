import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Plus, Settings2, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useXJCases } from '../hooks/useXJCases';
import {
  XJ_ROLE_DESCRIPTIONS,
  XJ_ROLE_LABELS,
  suggestXJAgentName,
  type XJAgentRole,
} from '../lib/agentRolePresets';
import { useXJPermissions } from '../extend/auth';
import { useXJScope } from '../context/XJScopeContext';
import { X_JULIA_ROUTES } from '../module';

export default function XJAgentsPage() {
  const { data: agents = [], isLoading } = useXJAgents();
  const { create, update, remove } = useXJAgentMutations();
  const permissions = useXJPermissions();
  const { clientId, clientLabel, canSwitch } = useXJScope();

  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('Recepção — X-Julia');
  const [role, setRole] = useState<XJAgentRole>('reception');
  const [caseId, setCaseId] = useState('');
  const { data: cases = [] } = useXJCases();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const takenCaseIds = new Set(
    agents.filter((a) => (a.role ?? 'reception') === 'specialist' && a.case_id).map((a) => a.case_id as string),
  );
  const availableCases = cases.filter((c) => !takenCaseIds.has(c.id));
  const selectedCase = cases.find((c) => c.id === caseId) ?? null;

  const openCreate = () => {
    setStep(1);
    setRole('reception');
    setCaseId('');
    setName(suggestXJAgentName('reception'));
    setCreating(true);
  };

  const pickRole = (next: XJAgentRole) => {
    setRole(next);
    setCaseId('');
    setName(suggestXJAgentName(next));
    setStep(2);
  };

  const handleCreate = async () => {
    const agent = await create.mutateAsync({
      name,
      role,
      case_id: role === 'specialist' ? caseId : null,
      case_name: selectedCase?.name ?? null,
    });
    setCreating(false);
    if (agent?.id) window.location.assign(X_JULIA_ROUTES.agent(agent.id));
  };

  const canCreate = permissions.canCreate && !!clientId;

  return (
    <XJLayout
      title="Agentes X-Julia"
      description="Cada agente tem prompt, LLM, voz, casos e followups próprios"
      actions={
        <div className="flex items-center gap-2">
          {canSwitch && (
            <Button asChild size="sm" variant="outline">
              <Link to={X_JULIA_ROUTES.offices}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Escritórios
              </Link>
            </Button>
          )}
          {permissions.canCreate && (
            <Button size="sm" onClick={openCreate} disabled={!canCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo agente
            </Button>
          )}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Escritório:</span>
        <Badge variant={clientId ? 'default' : 'secondary'}>
          {clientLabel || (clientId ? `ClientID ${clientId}` : 'nenhum selecionado')}
        </Badge>
        {!clientId && canSwitch && (
          <Link to={X_JULIA_ROUTES.offices} className="text-xs underline">
            selecionar escritório
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {clientId
                ? 'Nenhum agente criado ainda para este escritório.'
                : 'Selecione um escritório para criar agentes.'}
            </p>
            {permissions.canCreate && (
              <Button size="sm" onClick={openCreate} disabled={!canCreate}>
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
                  <Badge variant={(agent.role ?? 'reception') === 'specialist' ? 'outline' : 'secondary'}>
                    {(agent.role ?? 'reception') === 'specialist' ? 'Especialista' : 'Recepcionista'}
                  </Badge>
                  {(agent.role ?? 'reception') === 'specialist' && (
                    <Badge variant="outline">
                      {cases.find((c) => c.id === agent.case_id)?.name ?? 'sem caso vinculado'}
                    </Badge>
                  )}
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
            <DialogDescription>
              {step === 1
                ? 'Escolha a função do agente — o prompt e as configurações já vêm prontos para ela.'
                : 'Confirme os dados. Prompt, LLM, voz e followups podem ser ajustados na próxima tela.'}
            </DialogDescription>
          </DialogHeader>

          {step === 1 ? (
            <div className="grid gap-3">
              {(['reception', 'specialist'] as XJAgentRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => pickRole(r)}
                  className="rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-muted/50"
                >
                  <p className="text-sm font-semibold">{XJ_ROLE_LABELS[r]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{XJ_ROLE_DESCRIPTIONS[r]}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={role === 'specialist' ? 'outline' : 'secondary'}>{XJ_ROLE_LABELS[role]}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
                  trocar função
                </Button>
              </div>
              {role === 'specialist' && (
                <div className="space-y-2">
                  <Label>Caso jurídico atendido</Label>
                  <Select
                    value={caseId || undefined}
                    onValueChange={(v) => {
                      setCaseId(v);
                      const c = cases.find((x) => x.id === v);
                      setName(suggestXJAgentName('specialist', c?.name));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={availableCases.length ? 'Selecione o caso' : 'Nenhum caso livre'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.category} · {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Casos já atendidos por outro especialista não aparecem na lista.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Nome do agente</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreating(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!name.trim() || create.isPending || (role === 'specialist' && !caseId)}
                >
                  Criar agente
                </Button>
              </DialogFooter>
            </div>
          )}
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