import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SmartAvatarImage } from '@/modules/julia-chat/chat/components/SmartAvatarImage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Users, Info, X, CheckCircle2, XCircle, ArrowRightLeft, Clock, MessageSquare, MessageCircle, Globe, Instagram, Search, Calendar, AlarmClock, UserCheck, Scale, Eye, Phone, PhoneOff, ExternalLink, Bot, Loader2, LifeBuoy, Undo2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { externalDb } from '@/lib/externalDb';
import type { SessionStatus } from '@/lib/externalDb';
import { toggleJuliaSession } from '@/lib/juliaSessionControl';
import { useAgentSessionStatus } from '@/hooks/useAgentSessionStatus';
import { useContractInfo } from '@/pages/crm/hooks/useContractInfo';
import { useCRMCardByWhatsapp, useCRMStages } from '@/pages/crm/hooks/useCRMData';
import { useQueueAgentLink } from '@/hooks/useQueueAgentLink';
import { useQuery } from '@tanstack/react-query';
import { usePhone } from '@/contexts/PhoneContext';
import { WavoipCallButton } from '@/modules/julia-chat/chat/components/WavoipCallButton';
import { SessionStatusDialog } from '@/pages/crm/components/SessionStatusDialog';
import { CRMLeadDetailsDialog } from '@/pages/crm/components/CRMLeadDetailsDialog';
import { PhoneCallDialog } from '@/pages/crm/components/PhoneCallDialog';
import { UpsellCallDialog } from '@/modules/julia-chat/chat/components/UpsellCallDialog';
import { useWhatsAppData } from '@/modules/julia-chat/chat/contexts/WhatsAppDataContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useConversationPresence } from '@/hooks/useConversationPresence';
import { useAssigneeNameResolver } from '@/hooks/useAssigneeNameResolver';
import { cn } from '@/lib/utils';
import type { ChatContact } from '@/types/chat';
import { TransferDialog } from './TransferDialog';
import { ReturnToQueueDialog } from './ReturnToQueueDialog';
import { CSATDialog } from './CSATDialog';
import { PresenceIndicator } from './PresenceIndicator';
import { ChatSearchDialog } from './ChatSearchDialog';
import { ScheduledMessagesList } from './ScheduledMessagesList';
import { SnoozeDialog } from './SnoozeDialog';
import { MediaLightbox } from './MediaLightbox';
import { ChatCrmButton } from './ChatCrmButton';
import { ChatTicketSidePanel } from './ChatTicketSidePanel';
import { ChatTicketDetailSidePanel } from './ChatTicketDetailSidePanel';
import { useTicketLinkedConversations } from '@/hooks/useTicketLinkedConversations';
import { useChatSlaConfigs, evaluateSla } from '@/hooks/useChatSlaConfigs';
import { useConversationsLastMessageMeta } from '@/hooks/useConversationsLastMessageMeta';
import { SlaBadge } from './SlaBadge';
import { PriorityBadge } from './PriorityBadge';
import { JuliaStatusBadge } from './JuliaStatusBadge';
import { GenerateSummaryButton } from './GenerateSummaryButton';

interface ChatHeaderProps {
  contact: ChatContact;
  onClose: () => void;
  onShowDetails?: () => void;
  onShowCrm?: () => void;
  /**
   * Modo somente-leitura: oculta ações de escrita (Assumir, Transferir,
   * Resolver, Encerrar, Reabrir, Adiar, Devolver, toggle Jul.IA, tickets…).
   * Mantém informações do contato, badges, avatar e botão fechar.
   */
  readOnly?: boolean;
}

function ChannelBadge({ channel }: { channel?: string }) {
  const config: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    whatsapp_uazapi: { label: 'WhatsApp', icon: <MessageCircle className="h-3 w-3" />, className: 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
    whatsapp_waba: { label: 'API Oficial', icon: <MessageCircle className="h-3 w-3" />, className: 'text-emerald-700 dark:text-emerald-400 border-emerald-600/30 bg-emerald-600/10' },
    webchat: { label: 'WebChat', icon: <Globe className="h-3 w-3" />, className: 'text-sky-700 dark:text-sky-400 border-sky-500/30 bg-sky-500/10' },
    instagram: { label: 'Instagram', icon: <Instagram className="h-3 w-3" />, className: 'text-pink-700 dark:text-pink-400 border-pink-500/30 bg-pink-500/10' },
  };
  const c = config[channel || ''] || config.whatsapp_uazapi;
  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 gap-1 border', c.className)}>
      {c.icon}
      {c.label}
    </Badge>
  );
}




export function ChatHeader({ contact, onClose, onShowDetails, onShowCrm, readOnly = false }: ChatHeaderProps) {
  const { selectedConversation, updateConversationStatus, assignConversation, filteredContacts, selectedContactId, selectContact, markAsRead, conversationTagsMap, setConversationStatusFilter, sendInternalNote } = useWhatsAppData();
  const { user, hasPermission } = useAuth();
  const { configs: slaConfigs } = useChatSlaConfigs();
  const { getMeta: getLastMsgMeta } = useConversationsLastMessageMeta(
    selectedConversation?.id ? [selectedConversation.id] : [],
  );

  const slaEvaluation = React.useMemo(() => {
    if (!selectedConversation) return null;
    if (['closed', 'resolved'].includes(selectedConversation.status)) return null;
    const meta = getLastMsgMeta(selectedConversation.id);
    return evaluateSla(
      {
        status: selectedConversation.status,
        priority: selectedConversation.priority,
        opened_at: selectedConversation.opened_at,
        first_response_at: selectedConversation.first_response_at || null,
        resolved_at: selectedConversation.resolved_at || null,
        closed_at: selectedConversation.closed_at || null,
        last_customer_message_at: meta.last_customer_message_at,
        last_message_from_me: meta.last_message_from_me,
      },
      slaConfigs
    );
  }, [selectedConversation, slaConfigs, getLastMsgMeta]);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showScheduledList, setShowScheduledList] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [showPhoneCall, setShowPhoneCall] = useState(false);
  const [showVoipUpsell, setShowVoipUpsell] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showTicketDetail, setShowTicketDetail] = useState<string | null>(null);

  const { data: ticketLinkMap } = useTicketLinkedConversations();
  const ticketLink = selectedConversation?.id ? ticketLinkMap?.get(selectedConversation.id) : undefined;
  const isPrivilegedRole = user?.role === 'admin' || user?.role === 'colaborador';
  const canViewTickets = hasPermission('support_tickets', 'view') || isPrivilegedRole;
  const canCreateTickets = hasPermission('support_tickets', 'create') || isPrivilegedRole;

  const { data: queueLink } = useQueueAgentLink(selectedConversation?.queue_id);
  const queueId = selectedConversation?.queue_id || null;
  const { data: queueName } = useQuery({
    queryKey: ['chat-header-queue-name', queueId],
    enabled: !!queueId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('queues')
        .select('name')
        .eq('id', queueId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.name as string) || null;
    },
  });
  const { sip } = usePhone();
  const callActive = sip.status === 'in-call';
  const phoneReady = ['registered', 'in-call', 'calling', 'ringing'].includes(sip.status);

  // Inline name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleNameDoubleClick = useCallback(() => {
    setEditingName(contact.name);
    setIsEditingName(true);
    setTimeout(() => {
      nameInputRef.current?.select();
    }, 0);
  }, [contact.name]);

  const handleNameSave = useCallback(async () => {
    const trimmed = editingName.trim();
    setIsEditingName(false);
    if (!trimmed || trimmed === contact.name) return;
    try {
      const { error } = await supabase
        .from('chat_contacts')
        .update({ name: trimmed })
        .eq('id', contact.id);
      if (error) throw error;
      toast.success('Nome atualizado');
    } catch (e) {
      toast.error('Erro ao atualizar nome');
    }
  }, [editingName, contact.name, contact.id]);

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleNameSave();
    if (e.key === 'Escape') setIsEditingName(false);
  }, [handleNameSave]);

  const presenceUsers = useConversationPresence(
    selectedConversation?.id || null,
    user?.id ? { id: String(user.id), name: user.name, avatar: (user as { avatar?: string }).avatar } : null,
  );

  const initials = contact.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: 'Pendente', color: 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/35', icon: <Clock className="h-3 w-3" /> },
    open: { label: 'Em atendimento', color: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/35', icon: <MessageSquare className="h-3 w-3" /> },
    closed: { label: 'Encerrada', color: 'bg-muted text-muted-foreground border-border', icon: <XCircle className="h-3 w-3" /> },
    resolved: { label: 'Resolvida', color: 'bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/35', icon: <CheckCircle2 className="h-3 w-3" /> },
  };

  const currentStatus = selectedConversation?.status || 'pending';
  const statusInfo = statusConfig[currentStatus] || statusConfig.pending;

  const handleConfirmClose = async (closeNote: string, _sendSurvey: boolean) => {
    if (!selectedConversation) return;
    const trimmedNote = (closeNote || '').trim();
    if (trimmedNote) {
      try {
        await sendInternalNote(
          selectedConversation.contact_id,
          trimmedNote,
          currentUserName || 'Sistema',
          { noteType: 'urgent', extraMetadata: { closure_note: true } }
        );
      } catch (e) {
        console.warn('[close] failed to post closure internal note', e);
      }
    }
    await updateConversationStatus(selectedConversation.id, 'closed', closeNote || undefined);
  };

  const currentUserName = user?.name || (user?.id ? String(user.id) : '');
  const { resolve: resolveAssignee } = useAssigneeNameResolver();
  const assignedRaw = selectedConversation?.assigned_to || null;
  const assignedDisplay = resolveAssignee(assignedRaw);
  const currentUserId = user?.id ? String(user.id) : '';
  const isAssignedToMe = !!assignedRaw && (
    (!!currentUserName && assignedRaw === currentUserName) ||
    (!!currentUserId && assignedRaw === currentUserId)
  );
  const canTakeOver = !!selectedConversation
    && ['pending', 'open'].includes(selectedConversation.status)
    && !isAssignedToMe;

  const handleTakeOver = async () => {
    if (!selectedConversation || !currentUserName) return;
    await assignConversation(selectedConversation.id, currentUserName, user?.id ? Number(user.id) : null);
    if (selectedConversation.status === 'pending') {
      await updateConversationStatus(selectedConversation.id, 'open');
    }
    // Now that the agent claimed the conversation, clear the unread badge.
    try { await markAsRead(contact.id); } catch (e) { /* noop */ }
    // Switch to "Em Atendimento" tab and keep focus on this conversation
    setConversationStatusFilter('open');
  };

  const handleResolve = async () => {
    if (!selectedConversation) return;
    await updateConversationStatus(selectedConversation.id, 'resolved');
  };

  const handleReopen = async () => {
    if (!selectedConversation) return;
    await updateConversationStatus(selectedConversation.id, 'open');
  };

  const handleTransfer = async (assignedTo: string, assignedUserId: number | null, note?: string) => {
    if (!selectedConversation) return;
    await assignConversation(selectedConversation.id, assignedTo, assignedUserId);
  };

  const handleReturnToQueue = async (note?: string) => {
    if (!selectedConversation) return;
    const removedAgent = (selectedConversation.assigned_to || '').trim() || null;
    const removedUserId = (selectedConversation as any)?.assigned_user_id
      ? Number((selectedConversation as any).assigned_user_id)
      : null;
    const actor = currentUserName || 'Sistema';
    try {
      const { error: updErr } = await supabase
        .from('chat_conversations')
        .update({ assigned_to: null, assigned_user_id: null, status: 'pending' })
        .eq('id', selectedConversation.id);
      if (updErr) throw updErr;

      if (note && note.trim()) {
        try {
          await sendInternalNote(
            selectedConversation.contact_id,
            note.trim(),
            actor,
            { noteType: 'info', extraMetadata: { returned_to_queue: true } },
          );
        } catch (e) {
          console.warn('[return-to-queue] failed to post internal note', e);
        }
      }

      const { error: histErr } = await supabase
        .from('chat_conversation_history')
        .insert({
          conversation_id: selectedConversation.id,
          action: 'returned_to_queue',
          actor_name: actor,
          from_value: removedAgent,
          from_user_id: removedUserId,
          user_id: user?.id ? Number(user.id) : null,
          to_value: 'pending',
          notes: note?.trim() || null,
        });
      if (histErr) throw histErr;

      toast.success('Conversa devolvida para a fila');
    } catch (e: any) {
      console.error('[return-to-queue] failed', e);
      toast.error(`Não foi possível devolver: ${e?.message || e}`);
      throw e;
    }
  };

  return (
    <>
      <div className="border-b aj-chat-bar aj-chat-bar-top">
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          onClick={() => contact.avatar && setAvatarOpen(true)}
          className={contact.avatar ? 'cursor-zoom-in' : 'cursor-default'}
          aria-label="Ver foto do contato"
        >
          <Avatar className="h-10 w-10 ring-1 ring-border/70">
            <SmartAvatarImage src={contact.avatar} alt={contact.name} contactId={contact.id} />
            <AvatarFallback className="bg-[image:var(--gradient-brand)] text-primary-foreground font-semibold">
              {contact.is_group ? <Users className="h-4 w-4" /> : initials}
            </AvatarFallback>
          </Avatar>
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <JuliaStatusBadge
              whatsappNumber={contact.phone}
              codAgent={selectedConversation?.cod_agent || contact.cod_agent}
              queueId={selectedConversation?.queue_id || null}
              assignedTo={selectedConversation?.assigned_to || null}
            />
            {isEditingName ? (
              <input
                ref={nameInputRef}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                className="font-medium bg-transparent border-b border-primary outline-none truncate max-w-[200px]"
              />
            ) : (
              <h3
                className="font-medium truncate cursor-text select-none"
                onDoubleClick={handleNameDoubleClick}
                title="Clique duplo para editar o nome"
              >
                {contact.name}
              </h3>
            )}
            {selectedConversation && (
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 gap-1 border', statusInfo.color)}>
                {statusInfo.icon}
                {statusInfo.label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground truncate">
              {contact.is_group ? 'Grupo' : contact.phone}
            </p>
            {selectedConversation?.protocol && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {selectedConversation.protocol}
              </span>
            )}
            <PresenceIndicator users={presenceUsers} meId={user?.id ? String(user.id) : null} />
          </div>
          {(queueName || slaEvaluation || selectedConversation) && (
            <div className="flex items-stretch gap-0 mt-1">
              {queueName && (
                <span
                  className="inline-flex items-center justify-center h-5 px-1.5 text-[9px] font-bold leading-none overflow-hidden whitespace-nowrap text-center bg-[image:var(--gradient-brand)] text-primary-foreground rounded-l w-[110px]"
                  title={`Fila: ${queueName}`}
                >
                  <span className="truncate">{queueName}</span>
                </span>
              )}
              {selectedConversation && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center h-5 px-1.5 text-[9px] leading-none overflow-hidden whitespace-nowrap text-center bg-secondary text-secondary-foreground w-[110px]',
                    !queueName && 'rounded-l',
                    !slaEvaluation && 'rounded-r',
                    selectedConversation.assigned_to ? 'font-bold' : 'font-normal'
                  )}
                  title={assignedDisplay || 'Não Atribuído'}
                >
                  <span className="truncate">
                    {assignedDisplay || 'Não Atribuído'}
                  </span>
                </span>
              )}
              {slaEvaluation && (
                <SlaBadge
                  evaluation={slaEvaluation}
                  compact
                  className={cn(!queueName && !selectedConversation && 'rounded-l', 'rounded-r w-[64px]')}
                />
              )}
              {selectedConversation && (
                <span className="ml-1 inline-flex items-center">
                  <PriorityBadge
                    conversationId={selectedConversation.id}
                    currentPriority={selectedConversation.priority}
                    compact
                  />
                </span>
              )}
            </div>
          )}
          {selectedConversation && (conversationTagsMap?.[selectedConversation.id] || []).length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-1">
              {(conversationTagsMap?.[selectedConversation.id] || []).map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                  style={{ backgroundColor: tag.color }}
                  title={tag.name}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {selectedConversation && !readOnly && (
          <div className="hidden md:flex flex-col items-end gap-2 shrink-0">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canTakeOver && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleTakeOver}
                  title={assignedDisplay ? `Assumir de ${assignedDisplay}` : 'Assumir conversa'}
                >
                  <UserCheck className="h-4 w-4" />
                  Assumir
                </Button>
              )}

              <ChatCrmButton
                conversationId={selectedConversation.id}
                contact={contact}
                codAgent={selectedConversation?.cod_agent || (contact as any).cod_agent || null}
                queueId={selectedConversation?.queue_id || null}
                onOpenPanel={onShowCrm}
              />

              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'gap-1.5',
                  phoneReady
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20 hover:text-emerald-800 dark:hover:text-emerald-300'
                    : 'text-muted-foreground border-border hover:bg-muted'
                )}
                onClick={() => (phoneReady ? setShowPhoneCall(true) : setShowVoipUpsell(true))}
                title={phoneReady ? 'VOIP Call (ramal disponível)' : 'VOIP Call indisponível'}
              >
                {phoneReady ? <Phone className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
                VOIP Call
              </Button>

              <WavoipCallButton
                phone={contact.phone}
                contactName={contact.name}
                queueId={selectedConversation?.queue_id || null}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">


              {(() => {
                const isActive = ['pending', 'open'].includes(currentStatus);
                return (
                  <div className="inline-flex items-center gap-0.5 border rounded px-1 py-0.5">
                    <GenerateSummaryButton
                      conversationId={selectedConversation?.id ?? null}
                      contactId={contact.id}
                      iconOnly
                      className="h-7 w-7"
                      onGenerated={onShowDetails}
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={onShowDetails}
                      title="Ver detalhes"
                    >
                      <Info className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 disabled:opacity-40"
                      onClick={() => setShowSnooze(true)}
                      disabled={!isActive}
                      title="Adiar conversa (z)"
                    >
                      <AlarmClock className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-50 disabled:opacity-40"
                      onClick={() => setShowTransferDialog(true)}
                      disabled={!isActive}
                      title="Transferir conversa (#)"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 disabled:opacity-40"
                      onClick={() => setShowReturnDialog(true)}
                      disabled={!isActive || !selectedConversation?.assigned_to}
                      title="Devolver para fila de atendimento"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400 disabled:opacity-40"
                      onClick={handleResolve}
                      disabled={!isActive}
                      title="Marcar como resolvida (e)"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
                      onClick={() => setShowCloseDialog(true)}
                      disabled={!isActive}
                      title="Encerrar conversa"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>

                    {!isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleReopen}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                        Reabrir
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setShowSearch(true)}>
                          <Search className="h-4 w-4 mr-2" />
                          Buscar nesta conversa
                        </DropdownMenuItem>
                        {(canViewTickets || canCreateTickets) && (
                          ticketLink && canViewTickets ? (
                            <DropdownMenuItem onClick={() => setShowTicketDetail(ticketLink.ticketId)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver ticket de suporte #{ticketLink.number ?? '—'}
                            </DropdownMenuItem>
                          ) : canCreateTickets ? (
                            <DropdownMenuItem onClick={() => setShowNewTicket(true)}>
                              <LifeBuoy className="h-4 w-4 mr-2" />
                              Abrir ticket de suporte
                            </DropdownMenuItem>
                          ) : null
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {selectedConversation && !readOnly && (
        <div className="px-3 pb-3 flex flex-col gap-2 md:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {canTakeOver && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={handleTakeOver}
              >
                <UserCheck className="h-4 w-4" />
                Assumir
              </Button>
            )}
            <ChatCrmButton
              conversationId={selectedConversation.id}
              contact={contact}
              codAgent={selectedConversation?.cod_agent || (contact as any).cod_agent || null}
              queueId={selectedConversation?.queue_id || null}
              onOpenPanel={onShowCrm}
            />
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'gap-1.5',
                phoneReady
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20 hover:text-emerald-800 dark:hover:text-emerald-300'
                  : 'text-muted-foreground border-border hover:bg-muted'
              )}
              onClick={() => (phoneReady ? setShowPhoneCall(true) : setShowVoipUpsell(true))}
            >
              {phoneReady ? <Phone className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
              VOIP Call
            </Button>
            <WavoipCallButton
              phone={contact.phone}
              contactName={contact.name}
              queueId={selectedConversation?.queue_id || null}
            />
          </div>
        </div>
      )}
      </div>

      {/* Close conversation dialog with CSAT survey */}
      {selectedConversation && (
        <CSATDialog
          open={showCloseDialog}
          onOpenChange={setShowCloseDialog}
          conversationId={selectedConversation.id}
          contactId={selectedConversation.contact_id}
          clientId={selectedConversation.client_id}
          codAgent={selectedConversation.cod_agent}
          onConfirm={handleConfirmClose}
        />
      )}

      {/* Transfer dialog */}
      <TransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        onTransfer={handleTransfer}
      />

      {/* Return to queue dialog */}
      <ReturnToQueueDialog
        open={showReturnDialog}
        onOpenChange={setShowReturnDialog}
        onConfirm={handleReturnToQueue}
        currentAssignee={assignedDisplay ?? undefined}
      />

      {/* Conversation search */}
      <ChatSearchDialog
        open={showSearch}
        onOpenChange={setShowSearch}
        contactId={contact.id}
        clientId={contact.client_id}
      />

      {/* Scheduled messages list */}
      <ScheduledMessagesList
        open={showScheduledList}
        onOpenChange={setShowScheduledList}
        contactId={contact.id}
      />

      {/* Snooze dialog */}
      <SnoozeDialog
        open={showSnooze}
        onOpenChange={setShowSnooze}
        conversationId={selectedConversation?.id || null}
      />

      {/* Phone call */}
      <PhoneCallDialog
        open={showPhoneCall}
        onOpenChange={setShowPhoneCall}
        whatsappNumber={contact.phone}
        contactName={contact.name}
        codAgent={queueLink?.codAgent ?? ''}
      />

      <UpsellCallDialog open={showVoipUpsell} onOpenChange={setShowVoipUpsell} product="voip" />

      {/* Abrir ticket de suporte a partir da conversa */}
      <ChatTicketSidePanel
        open={showNewTicket}
        onClose={() => setShowNewTicket(false)}
        contact={contact}
        conversation={selectedConversation ?? null}
      />

      {showTicketDetail && (
        <ChatTicketDetailSidePanel
          open
          onClose={() => setShowTicketDetail(null)}
          ticketId={showTicketDetail}
        />
      )}

      <MediaLightbox
        open={avatarOpen}
        onOpenChange={setAvatarOpen}
        url={contact.avatar ?? null}
        caption={contact.name}
        fileName={`${(contact.name || contact.phone).replace(/[^a-zA-Z0-9-_]+/g, '_')}.jpg`}
        kind="image"
      />
    </>
  );
}