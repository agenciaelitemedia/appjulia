import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, MessageSquare, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { XJLayout } from '../components/XJLayout';
import { XJQualificationBadge, XJStageBadge } from '../components/XJStageBadge';
import { useXJSessions } from '../hooks/useXJSessions';
import { useXJSessionAdmin } from '../hooks/useXJSessionAdmin';
import { useXJCases } from '../hooks/useXJCases';
import { useOpenChatConversation } from '../extend/chat';
import { XJ_STAGES, XJ_STAGE_LABELS, X_JULIA_ROUTES } from '../module';
import type { XJSession } from '../types';

const NO_CASE = '__none__';

function fmt(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

export default function XJSessionsManagePage() {
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [qualification, setQualification] = useState('all');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<XJSession | null>(null);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: allSessions = [], isLoading } = useXJSessions({
    search,
    stage: stage === 'all' ? undefined : stage,
    qualification: qualification === 'all' ? undefined : qualification,
  });
  const { data: cases = [] } = useXJCases();
  const { pause, resume, updateFields, remove, advanceStage } = useXJSessionAdmin();
  const openChat = useOpenChatConversation();

  const sessions = useMemo(
    () =>
      allSessions.filter((s) =>
        status === 'all' ? true : status === 'active' ? !!s.is_active : !s.is_active,
      ),
    [allSessions, status],
  );

  const allChecked = sessions.length > 0 && selected.length === sessions.length;
  const toggleAll = () => setSelected(allChecked ? [] : sessions.map((s) => s.id));
  const toggleOne = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const askDelete = (ids: string[]) => {
    setConfirmDelete(false);
    setDeleting(ids);
  };

  return (
    <XJLayout
      title="Sessões X-Julia"
      description="Gestão das sessões do agente: ativar, pausar, mudar etapa, editar dados e excluir"
      actions={
        selected.length > 0 ? (
          <>
            <Badge variant="secondary">{selected.length} selecionada(s)</Badge>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => pause.mutate(selected)}>
              <Pause className="mr-1.5 h-4 w-4" /> Pausar
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => resume.mutate(selected)}>
              <Play className="mr-1.5 h-4 w-4" /> Reativar
            </Button>
            <Button variant="destructive" size="sm" className="rounded-full" onClick={() => askDelete(selected)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
            </Button>
          </>
        ) : null
      }
    >
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Input
            placeholder="Buscar por nome, telefone ou caso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72"
          />
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {XJ_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {XJ_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={qualification} onValueChange={setQualification}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Qualificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="qualificado">Qualificado</SelectItem>
              <SelectItem value="desqualificado">Desqualificado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ativas e inativas</SelectItem>
              <SelectItem value="active">Somente ativas</SelectItem>
              <SelectItem value="inactive">Somente inativas</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma sessão encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Selecionar todas" />
                  </TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Caso / origem</TableHead>
                  <TableHead className="w-56">Etapa</TableHead>
                  <TableHead>Qualificação</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Última atividade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(session.id)}
                        onCheckedChange={() => toggleOne(session.id)}
                        aria-label="Selecionar sessão"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{session.contact_name || 'Sem nome'}</div>
                      <div className="text-xs text-muted-foreground">{session.phone || '—'}</div>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate text-sm">{session.case_type || '—'}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[session.channel, session.origin, session.campaign_id].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <XJStageBadge stage={session.stage} />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Select
                                value={session.stage}
                                onValueChange={(next) =>
                                  next !== session.stage &&
                                  advanceStage.mutate({ sessionId: session.id, stage: next })
                                }
                              >
                                <SelectTrigger className="h-8 w-[130px] text-xs">
                                  <SelectValue placeholder="Mover" />
                                </SelectTrigger>
                                <SelectContent>
                                  {XJ_STAGES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {XJ_STAGE_LABELS[s]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            O agente assume a etapa e continua o atendimento na hora
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      <XJQualificationBadge value={session.qualification} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.is_active ? 'default' : 'secondary'}>
                        {session.is_active ? 'Ativa' : session.paused_reason || 'Inativa'}
                      </Badge>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{session.turns} turnos</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>Lead: {fmt(session.last_customer_message_at)}</div>
                      <div>Agente: {fmt(session.last_agent_message_at)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {session.is_active ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            title="Pausar agente"
                            onClick={() => pause.mutate([session.id])}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full text-emerald-600"
                            title="Reativar agente"
                            onClick={() => resume.mutate([session.id])}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          title="Editar sessão"
                          onClick={() => setEditing(session)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full text-green-600"
                          title="Abrir chat"
                          onClick={() => openChat({ contactId: session.contact_id, phone: session.phone })}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded-full" title="Detalhes">
                          <Link to={X_JULIA_ROUTES.session(session.id)}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full text-destructive"
                          title="Excluir sessão"
                          onClick={() => askDelete([session.id])}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditSessionDialog
        session={editing}
        cases={cases as any[]}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (!editing) return;
          updateFields.mutate({ sessionId: editing.id, patch }, { onSuccess: () => setEditing(null) });
        }}
        saving={updateFields.isPending}
      />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {deleting?.length === 1 ? 'sessão' : `${deleting?.length} sessões`}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A sessão, seus eventos e followups serão apagados. O lead volta ao estado inicial (como se nunca tivesse
            iniciado atendimento). As mensagens do chat não são afetadas.
          </p>
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Switch checked={confirmDelete} onCheckedChange={setConfirmDelete} id="xj-confirm-delete" />
            <Label htmlFor="xj-confirm-delete" className="text-sm">
              Confirmo a exclusão definitiva
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!confirmDelete || remove.isPending}
              onClick={() =>
                deleting &&
                remove.mutate(deleting, {
                  onSuccess: () => {
                    setSelected([]);
                    setDeleting(null);
                  },
                })
              }
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </XJLayout>
  );
}

function EditSessionDialog({
  session,
  cases,
  onClose,
  onSave,
  saving,
}: {
  session: XJSession | null;
  cases: any[];
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [qualification, setQualification] = useState('pendente');
  const [reason, setReason] = useState('');
  const [caseType, setCaseType] = useState('');
  const [caseId, setCaseId] = useState(NO_CASE);
  const [slots, setSlots] = useState<Array<{ key: string; value: string }>>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Sincroniza o formulário quando outra sessão é aberta.
  if (session && loadedFor !== session.id) {
    setLoadedFor(session.id);
    setQualification(session.qualification || 'pendente');
    setReason(session.qualification_reason || '');
    setCaseType(session.case_type || '');
    setCaseId(session.case_id || NO_CASE);
    setSlots(
      Object.entries(session.slots || {})
        .filter(([k]) => !k.startsWith('__'))
        .map(([key, value]) => ({ key, value: typeof value === 'string' ? value : JSON.stringify(value) })),
    );
  }

  const handleSave = () => {
    if (!session) return;
    const hidden = Object.entries(session.slots || {}).filter(([k]) => k.startsWith('__'));
    const nextSlots: Record<string, unknown> = Object.fromEntries(hidden);
    for (const { key, value } of slots) {
      if (key.trim()) nextSlots[key.trim()] = value;
    }
    onSave({
      qualification,
      qualification_reason: reason.trim() || null,
      case_type: caseType.trim() || null,
      case_id: caseId === NO_CASE ? null : caseId,
      slots: nextSlots,
    });
  };

  return (
    <Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar sessão — {session?.contact_name || session?.phone || ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Qualificação</Label>
              <Select value={qualification} onValueChange={setQualification}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="qualificado">Qualificado</SelectItem>
                  <SelectItem value="desqualificado">Desqualificado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Caso da biblioteca</Label>
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CASE}>Nenhum</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de caso (texto livre)</Label>
            <Input value={caseType} onChange={(e) => setCaseType(e.target.value)} placeholder="Ex.: BPC/LOAS" />
          </div>
          <div className="space-y-1.5">
            <Label>Motivo da qualificação</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dados coletados</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setSlots((prev) => [...prev, { key: '', value: '' }])}
              >
                Adicionar campo
              </Button>
            </div>
            {slots.length === 0 && <p className="text-xs text-muted-foreground">Nenhum dado coletado.</p>}
            {slots.map((slot, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  className="w-40"
                  placeholder="chave"
                  value={slot.key}
                  onChange={(e) =>
                    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, key: e.target.value } : s)))
                  }
                />
                <Input
                  placeholder="valor"
                  value={slot.value}
                  onChange={(e) =>
                    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, value: e.target.value } : s)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => setSlots((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}