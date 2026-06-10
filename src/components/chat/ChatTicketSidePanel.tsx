import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { TeamMemberSelect, type TeamMemberOption } from '@/components/TeamMemberSelect';
import { useSupportConfig, useTicketMutations } from '@/pages/tickets/hooks/useTickets';
import { PRIORITY_LABEL, type TicketPriority } from '@/pages/tickets/types';
import type { ChatContact } from '@/types/chat';
import type { ChatConversation } from '@/types/conversation';
import { cn } from '@/lib/utils';

interface ChatTicketSidePanelProps {
  open: boolean;
  onClose: () => void;
  contact: ChatContact;
  conversation: ChatConversation | null;
  onCreated?: (id: string) => void;
}

/**
 * Painel lateral (não-modal) para abrir um chamado a partir de uma conversa.
 * - Convive com a área de mensagens (não bloqueia cópia/edição/envio).
 * - Só fecha pelo botão X.
 * - Reseta o formulário a cada novo alvo (contato/conversa) via `key`.
 */
export function ChatTicketSidePanel(props: ChatTicketSidePanelProps) {
  const { open, onClose, contact, conversation } = props;
  if (!open) return null;
  const formKey = `${contact.id}|${conversation?.id ?? ''}`;
  return createPortal(
    <div
      className="fixed top-0 right-0 h-full w-full sm:w-[460px] z-40 bg-background border-l shadow-2xl flex flex-col"
      role="dialog"
      aria-label="Abrir chamado"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <LifeBuoy className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold truncate">Abrir chamado</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ChatTicketForm
          key={formKey}
          contact={contact}
          conversation={conversation}
          onClose={onClose}
          onCreated={props.onCreated}
        />
      </div>
    </div>,
    document.body,
  );
}

function ChatTicketForm({
  contact,
  conversation,
  onClose,
  onCreated,
}: {
  contact: ChatContact;
  conversation: ChatConversation | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const { user } = useAuth();
  const { departments, categories } = useSupportConfig();
  const { create } = useTicketMutations();
  const { data: team = [] } = useTeamByClient();
  const memberOptions: TeamMemberOption[] = useMemo(
    () => (team || []).map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, photo: m.photo })),
    [team],
  );

  const isGroup = !!contact.is_group || (contact.remote_jid?.endsWith('@g.us') ?? false);

  const [name, setName] = useState<string>(contact.name || user?.name || '');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>(contact.phone ?? '');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Default "responsável" (por nome, igual ao TransferDialog) = usuário logado
  const defaultAssignedName = useMemo(() => {
    if (!user) return null;
    const userIdStr = String(user.id ?? '');
    const byId = team.find((m) => String(m.id) === userIdStr);
    if (byId) return byId.name;
    const byName = team.find((m) => (m.name || '').trim() === (user.name || '').trim());
    if (byName) return byName.name;
    return null;
  }, [team, user]);

  const [assignedName, setAssignedName] = useState<string | null>(null);
  useEffect(() => {
    if (!assignedName && defaultAssignedName) setAssignedName(defaultAssignedName);
  }, [defaultAssignedName, assignedName]);

  const deptCategories = useMemo(
    () => categories.filter((c) => !c.department_id || c.department_id === departmentId),
    [categories, departmentId],
  );

  const handleSubmit = async () => {
    if (!subject.trim()) {
      toast.error('Informe o assunto');
      return;
    }
    setSaving(true);
    try {
      const assignedMember = assignedName
        ? team.find((m) => (m.name || '').trim() === assignedName.trim()) || null
        : null;
      const id = await create.mutateAsync({
        subject: subject.trim(),
        description: description.trim() || undefined,
        priority,
        department_id: departmentId || null,
        category_id: categoryId || null,
        requester_name: name.trim() || undefined,
        requester_email: email.trim() || undefined,
        requester_phone: phone.trim() || undefined,
        conversation_id: conversation?.id ?? null,
        contact_id: contact.id,
        assigned_to: assignedMember ? String(assignedMember.id) : null,
        assigned_to_name: assignedMember ? assignedMember.name : null,
        metadata: {
          is_group: isGroup,
          group_jid: isGroup ? contact.remote_jid ?? null : null,
          source: 'chat',
        },
      });
      toast.success('Chamado aberto');
      onCreated?.(id);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao abrir chamado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      {isGroup && (
        <div className="text-xs px-2 py-1.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
          Este chamado está vinculado a um grupo do WhatsApp.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled />
        </div>
        <div className="space-y-1">
          <Label>Telefone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(opcional)" disabled />
        </div>
      </div>

      <div className="space-y-1">
        <Label>E-mail</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label>Responsável pelo atendimento</Label>
        <TeamMemberSelect
          members={memberOptions}
          value={assignedName}
          onValueChange={setAssignedName}
          valueKey="name"
          allowUnassigned={false}
          showCurrentUserShortcut
          placeholder="Selecione um membro da equipe…"
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Departamento</Label>
          <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setCategoryId(''); }}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Categoria</Label>
          <Select value={categoryId} onValueChange={setCategoryId} disabled={deptCategories.length === 0}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {deptCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Prioridade</Label>
        <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
              <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Assunto</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumo do problema" />
      </div>
      <div className="space-y-1">
        <Label>Descrição</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[100px]" placeholder="Descreva o problema" />
      </div>

      <div className={cn('flex justify-end gap-2 pt-2 border-t')}>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Abrindo…' : 'Abrir chamado'}</Button>
      </div>
    </div>
  );
}