import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, LifeBuoy, Loader2, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { TeamMemberSelect, type TeamMemberOption } from '@/components/TeamMemberSelect';
import {
  useTicket, useTicketMutations, useSupportConfig,
} from '@/pages/tickets/hooks/useTickets';
import {
  PRIORITY_LABEL, STATUS_LABEL, STATUS_BADGE,
  type TicketPriority, type TicketStatus,
} from '@/pages/tickets/types';

interface Props {
  open: boolean;
  onClose: () => void;
  ticketId: string;
}

/**
 * Painel lateral de detalhes/edição de um ticket existente, aberto a partir
 * da lista de conversas. Usa as mesmas mutations do módulo /tickets, então
 * o trigger DB mantém o vínculo `active_ticket_id` da conversa coerente.
 */
export function ChatTicketDetailSidePanel({ open, onClose, ticketId }: Props) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed top-0 right-0 h-full w-full sm:w-[460px] z-40 bg-background border-l shadow-2xl flex flex-col"
      role="dialog"
      aria-label="Detalhes do chamado"
    >
      <Body ticketId={ticketId} onClose={onClose} />
    </div>,
    document.body,
  );
}

function Body({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('support_tickets', 'edit');
  const canDelete = hasPermission('support_tickets', 'delete');

  const { ticket, isLoading } = useTicket(ticketId);
  const { departments, categories } = useSupportConfig();
  const { update, setStatus, assign, deleteTicket } = useTicketMutations();
  const { data: team = [] } = useTeamByClient();

  const memberOptions: TeamMemberOption[] = useMemo(
    () => (team || []).map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, photo: m.photo })),
    [team],
  );

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [assignedName, setAssignedName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Hidrata o formulário quando o ticket carrega
  useEffect(() => {
    if (!ticket) return;
    setSubject(ticket.subject || '');
    setDescription(ticket.description || '');
    setPriority(ticket.priority);
    setDepartmentId(ticket.department_id || '');
    setCategoryId(ticket.category_id || '');
    setAssignedName(ticket.assigned_to_name || null);
  }, [ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const deptCategories = useMemo(
    () => categories.filter((c) => !c.department_id || c.department_id === departmentId),
    [categories, departmentId],
  );

  const handleSave = async () => {
    if (!ticket) return;
    if (!canEdit) {
      toast.error('Você não tem permissão para editar este chamado.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Informe o assunto');
      return;
    }
    setSaving(true);
    try {
      // Atribuição (assign separado, dispara log próprio)
      const newAssigned = assignedName
        ? team.find((m) => (m.name || '').trim() === assignedName.trim()) || null
        : null;
      const newAssignedId = newAssigned ? String(newAssigned.id) : null;
      const newAssignedName = newAssigned ? newAssigned.name : null;
      if (newAssignedId !== (ticket.assigned_to ?? null) || newAssignedName !== (ticket.assigned_to_name ?? null)) {
        await assign.mutateAsync({ ticketId, assignedTo: newAssignedId, assignedToName: newAssignedName });
      }

      const patch: Record<string, unknown> = {};
      if (subject.trim() !== (ticket.subject || '')) patch.subject = subject.trim();
      if ((description || '') !== (ticket.description || '')) patch.description = description.trim() || null;
      if (priority !== ticket.priority) patch.priority = priority;
      if ((departmentId || null) !== (ticket.department_id || null)) patch.department_id = departmentId || null;
      if ((categoryId || null) !== (ticket.category_id || null)) patch.category_id = categoryId || null;

      if (Object.keys(patch).length > 0) {
        await update.mutateAsync({ ticketId, patch, event: 'Detalhes do chamado atualizados' });
      }
      toast.success('Chamado atualizado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar chamado');
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (status: TicketStatus) => {
    if (!canEdit) {
      toast.error('Você não tem permissão para alterar o status.');
      return;
    }
    try {
      await setStatus.mutateAsync({ ticketId, status });
      toast.success(`Status: ${STATUS_LABEL[status]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao alterar status');
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteTicket.mutateAsync(ticketId);
      toast.success('Chamado excluído');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir chamado');
    }
  };

  const isClosed = ticket && ['resolved', 'closed'].includes(ticket.status);

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <LifeBuoy className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold truncate">
            {ticket?.number != null ? `Ticket #${ticket.number}` : 'Detalhes do chamado'}
          </span>
          {ticket && (
            <Badge variant="secondary" className={`text-[10px] ${STATUS_BADGE[ticket.status]}`}>
              {STATUS_LABEL[ticket.status]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {ticket && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => window.open(`/tickets/${ticket.id}`, '_blank', 'noopener')}
              title="Abrir no módulo de chamados"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading || !ticket ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="space-y-1">
              <Label>Assunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!canEdit || saving} />
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px]"
                disabled={!canEdit || saving}
              />
            </div>

            <div className="space-y-1">
              <Label>Responsável pelo atendimento</Label>
              <TeamMemberSelect
                members={memberOptions}
                value={assignedName}
                onValueChange={setAssignedName}
                valueKey="name"
                allowUnassigned
                showCurrentUserShortcut
                placeholder="Selecione um membro da equipe…"
                className="w-full"
                disabled={!canEdit || saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Departamento</Label>
                <Select
                  value={departmentId}
                  onValueChange={(v) => { setDepartmentId(v); setCategoryId(''); }}
                  disabled={!canEdit || saving}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select
                  value={categoryId}
                  onValueChange={setCategoryId}
                  disabled={!canEdit || saving || deptCategories.length === 0}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {deptCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)} disabled={!canEdit || saving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status atual</Label>
                <Select
                  value={ticket.status}
                  onValueChange={(v) => handleStatus(v as TicketStatus)}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {ticket.requester_name && (
              <div className="text-xs text-muted-foreground pt-1">
                Solicitante: <span className="text-foreground">{ticket.requester_name}</span>
                {ticket.requester_phone ? ` · ${ticket.requester_phone}` : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {ticket && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            {canDelete && (
              <Button
                variant={confirmDelete ? 'destructive' : 'ghost'}
                size="sm"
                onClick={handleDelete}
                onBlur={() => setConfirmDelete(false)}
                title={confirmDelete ? 'Clique novamente para confirmar' : 'Excluir chamado'}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {confirmDelete ? 'Confirmar' : 'Excluir'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isClosed && canEdit && (
              <Button variant="outline" size="sm" onClick={() => handleStatus('resolved')}>
                Resolver
              </Button>
            )}
            {isClosed && canEdit && (
              <Button variant="outline" size="sm" onClick={() => handleStatus('open')}>
                Reabrir
              </Button>
            )}
            <Button onClick={handleSave} disabled={!canEdit || saving} size="sm">
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}