import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SmartAvatarImage } from '@/components/chat/SmartAvatarImage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Users, Info, X, CheckCircle2, XCircle, ArrowRightLeft, Clock, MessageSquare, MessageCircle, Globe, Instagram, Search, Calendar, AlarmClock, Keyboard, UserCheck, Scale, Eye, Phone, PhoneOff, ExternalLink, Bot, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { externalDb } from '@/lib/externalDb';
import type { SessionStatus } from '@/lib/externalDb';
import { useContractInfo } from '@/pages/crm/hooks/useContractInfo';
import { useCRMCardByWhatsapp, useCRMStages } from '@/pages/crm/hooks/useCRMData';
import { useQueueAgentLink } from '@/hooks/useQueueAgentLink';
import { useQuery } from '@tanstack/react-query';
import { usePhone } from '@/contexts/PhoneContext';
import { SessionStatusDialog } from '@/pages/crm/components/SessionStatusDialog';
import { CRMLeadDetailsDialog } from '@/pages/crm/components/CRMLeadDetailsDialog';
import { PhoneCallDialog } from '@/pages/crm/components/PhoneCallDialog';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useConversationPresence } from '@/hooks/useConversationPresence';
import { useChatKeyboardShortcuts } from '@/hooks/useChatKeyboardShortcuts';
import { useAutoSummaryOnStatusChange } from '@/hooks/useAutoSummaryOnStatusChange';
import { cn } from '@/lib/utils';
import type { ChatContact } from '@/types/chat';
import { TransferDialog } from './TransferDialog';
import { CSATDialog } from './CSATDialog';
import { PresenceIndicator } from './PresenceIndicator';
import { ChatSearchDialog } from './ChatSearchDialog';
import { ScheduledMessagesList } from './ScheduledMessagesList';
import { SnoozeDialog } from './SnoozeDialog';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { ChatCrmButton } from './ChatCrmButton';
import { useChatSlaConfigs, evaluateSla } from '@/hooks/useChatSlaConfigs';
import { useConversationsLastMessageMeta } from '@/hooks/useConversationsLastMessageMeta';
import { SlaBadge } from './SlaBadge';
import { PriorityBadge } from './PriorityBadge';
import { JuliaStatusBadge } from './JuliaStatusBadge';

interface ChatHeaderProps {
  contact: ChatContact;
  onClose: () => void;
  onShowDetails?: () => void;
}

function ChannelBadge({ channel }: { channel?: string }) {
  const config: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    whatsapp_uazapi: { label: 'WhatsApp', icon: <MessageCircle className="h-3 w-3" />, className: 'text-emerald-600 border-emerald-500/30 bg-emerald-500/5' },
    whatsapp_waba: { label: 'API Oficial', icon: <MessageCircle className="h-3 w-3" />, className: 'text-emerald-700 border-emerald-600/30 bg-emerald-600/5' },
    webchat: { label: 'WebChat', icon: <Globe className="h-3 w-3" />, className: 'text-blue-600 border-blue-500/30 bg-blue-500/5' },
    instagram: { label: 'Instagram', icon: <Instagram className="h-3 w-3" />, className: 'text-pink-600 border-pink-500/30 bg-pink-500/5' },
  };
  const c = config[channel || ''] || config.whatsapp_uazapi;
  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 gap-1 border', c.className)}>
      {c.icon}
      {c.label}
    </Badge>
  );
}

interface CrmActionBarProps {
  phone: string;
  queueId: string | null | undefined;
  contactName: string;
}

function CrmActionBar({ phone, queueId, contactName }: CrmActionBarProps) {
  const navigate = useNavigate();
  const { data: queueLink } = useQueueAgentLink(queueId);
  const codAgent = queueLink?.codAgent ?? null;

  const { data: contractInfo } = useContractInfo(phone, codAgent ?? '', !!codAgent);
  const { data: crmCard } = useCRMCardByWhatsapp(codAgent ? phone : null);
  const { data: stages = [] } = useCRMStages();

  const [sessionData, setSessionData] = useState<SessionStatus | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [updatingSession, setUpdatingSession] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!phone || !codAgent) { setSessionData(null); return; }
    let cancelled = false;
    setSessionLoading(true);
    externalDb.getSessionStatus(phone, codAgent)
      .then(result => { if (!cancelled) setSessionData(result); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSessionLoading(false); });
    return () => { cancelled = true; };
  }, [phone, codAgent]);

  const handleToggleSession = async () => {
    if (!sessionData) return;
    setUpdatingSession(true);
    try {
      const newStatus = !sessionData.active;
      await externalDb.updateSessionStatus(sessionData.id, newStatus);
      setSessionData({ ...sessionData, active: newStatus });
    } catch {
      /* noop */
    } finally {
      setUpdatingSession(false);
      setConfirmToggle(false);
    }
  };

  if (!queueLink?.hasAgent || !codAgent) return null;

  return (
    <>
      <div className="inline-flex items-center gap-1 border rounded px-2 py-1">
        <span className="text-[10px] text-muted-foreground mr-1 font-medium">Julia</span>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => contractInfo && undefined}
              disabled={!contractInfo}
              className={cn('p-1 rounded hover:bg-muted transition-colors', !contractInfo && 'opacity-40 cursor-not-allowed')}
            >
              <Scale className={cn('h-4 w-4', contractInfo ? 'text-primary' : 'text-muted-foreground')} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{contractInfo ? 'Ver contrato' : 'Sem contrato'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => crmCard && setDetailsOpen(true)}
              disabled={!crmCard}
              className={cn('p-1 rounded hover:bg-muted transition-colors', !crmCard && 'opacity-40 cursor-not-allowed')}
            >
              <Eye className={cn('h-4 w-4', crmCard ? 'text-foreground' : 'text-muted-foreground')} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Detalhes do card CRM</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => navigate(`/crm/leads?whatsapp=${encodeURIComponent(phone)}`)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-blue-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Ver no CRM</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setStatusDialogOpen(true)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <Bot className={cn(
                'h-4 w-4',
                sessionLoading ? 'text-muted-foreground animate-pulse' :
                sessionData?.active === true ? 'text-green-500' :
                sessionData?.active === false ? 'text-red-500' :
                'text-muted-foreground'
              )} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Status do agente Julia</TooltipContent>
        </Tooltip>

        <Switch
          checked={sessionData?.active ?? false}
          onCheckedChange={() => setConfirmToggle(true)}
          disabled={!sessionData || updatingSession || sessionLoading}
          className="scale-75"
        />
      </div>

      <AlertDialog open={confirmToggle} onOpenChange={setConfirmToggle}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sessionData?.active ? 'Desativar atendimento?' : 'Ativar atendimento?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sessionData?.active
                ? 'Ao desativar, o agente não responderá mais este contato até ser ativado novamente.'
                : 'Ao ativar, o agente voltará a responder este contato.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingSession}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleSession} disabled={updatingSession}>
              {updatingSession && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {sessionData?.active ? 'Desativar' : 'Ativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SessionStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        whatsappNumber={phone}
        codAgent={codAgent!}
      />

      <CRMLeadDetailsDialog
        card={crmCard ?? null}
        stages={stages}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

    </>
  );
}

export function ChatHeader({ contact, onClose, onShowDetails }: ChatHeaderProps) {
  const { selectedConversation, updateConversationStatus, assignConversation, filteredContacts, selectedContactId, selectContact, markAsRead, conversationTagsMap, setConversationStatusFilter } = useWhatsAppData();
  const { user } = useAuth();
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
  const [showSearch, setShowSearch] = useState(false);
  const [showScheduledList, setShowScheduledList] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPhoneCall, setShowPhoneCall] = useState(false);

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

  // Navigation between conversations (j/k)
  const navigateBy = (delta: number) => {
    if (!filteredContacts.length || !selectedContactId) return;
    const idx = filteredContacts.findIndex((c) => c.id === selectedContactId);
    if (idx === -1) return;
    const next = filteredContacts[(idx + delta + filteredContacts.length) % filteredContacts.length];
    if (next) selectContact(next.id);
  };

  useChatKeyboardShortcuts({
    onNext: () => navigateBy(1),
    onPrev: () => navigateBy(-1),
    onResolve: () => {
      if (selectedConversation && ['pending', 'open'].includes(selectedConversation.status)) {
        updateConversationStatus(selectedConversation.id, 'resolved');
      }
    },
    onTransfer: () => selectedConversation && setShowTransferDialog(true),
    onSearch: () => setShowSearch(true),
    onSnooze: () => selectedConversation && setShowSnooze(true),
    onClose: () => onClose(),
    onHelp: () => setShowHelp(true),
  });

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
    pending: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: <Clock className="h-3 w-3" /> },
    open: { label: 'Em atendimento', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: <MessageSquare className="h-3 w-3" /> },
    closed: { label: 'Encerrada', color: 'bg-muted text-muted-foreground border-border', icon: <XCircle className="h-3 w-3" /> },
    resolved: { label: 'Resolvida', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: <CheckCircle2 className="h-3 w-3" /> },
  };

  const currentStatus = selectedConversation?.status || 'pending';
  const statusInfo = statusConfig[currentStatus] || statusConfig.pending;

  const handleConfirmClose = async (closeNote: string, _sendSurvey: boolean) => {
    if (!selectedConversation) return;
    await updateConversationStatus(selectedConversation.id, 'closed', closeNote || undefined);
    triggerAutoSummary(selectedConversation.id, 'auto_close');
  };

  const currentUserName = user?.name || (user?.id ? String(user.id) : '');
  const isAssignedToMe = !!selectedConversation?.assigned_to && !!currentUserName && selectedConversation.assigned_to === currentUserName;
  const canTakeOver = !!selectedConversation
    && ['pending', 'open'].includes(selectedConversation.status)
    && !isAssignedToMe;

  const handleTakeOver = async () => {
    if (!selectedConversation || !currentUserName) return;
    await assignConversation(selectedConversation.id, currentUserName);
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
    triggerAutoSummary(selectedConversation.id, 'auto_resolve');
  };

  const handleReopen = async () => {
    if (!selectedConversation) return;
    await updateConversationStatus(selectedConversation.id, 'open');
  };

  const handleTransfer = async (assignedTo: string, note?: string) => {
    if (!selectedConversation) return;
    await assignConversation(selectedConversation.id, assignedTo);
  };

  return (
    <>
      <div className="border-b bg-background">
      <div className="flex items-center gap-3 p-3">
        <Avatar className="h-10 w-10">
          <SmartAvatarImage src={contact.avatar} alt={contact.name} contactId={contact.id} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {contact.is_group ? <Users className="h-4 w-4" /> : initials}
          </AvatarFallback>
        </Avatar>
        
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
            {selectedConversation && (conversationTagsMap?.[selectedConversation.id] || []).slice(0, 3).map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                style={{ backgroundColor: tag.color }}
                title={tag.name}
              >
                {tag.name}
              </span>
            ))}
            <PresenceIndicator users={presenceUsers} meId={user?.id ? String(user.id) : null} />
          </div>
          {(queueName || slaEvaluation || selectedConversation) && (
            <div className="flex items-stretch gap-0 mt-1">
              {queueName && (
                <span
                  className="inline-flex items-center justify-center h-5 px-1.5 text-[9px] font-bold leading-none overflow-hidden whitespace-nowrap text-center bg-blue-600 text-white rounded-l w-[110px]"
                  title={`Fila: ${queueName}`}
                >
                  <span className="truncate">{queueName}</span>
                </span>
              )}
              {selectedConversation && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center h-5 px-1.5 text-[9px] leading-none overflow-hidden whitespace-nowrap text-center bg-slate-100 text-slate-900 w-[110px]',
                    !queueName && 'rounded-l',
                    !slaEvaluation && 'rounded-r',
                    selectedConversation.assigned_to ? 'font-bold' : 'font-normal'
                  )}
                  title={selectedConversation.assigned_to || 'Não Atribuído'}
                >
                  <span className="truncate">
                    {selectedConversation.assigned_to || 'Não Atribuído'}
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
        </div>
        
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {/* Assumir conversa */}
          {canTakeOver && (
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={handleTakeOver}
              title={selectedConversation?.assigned_to ? `Assumir de ${selectedConversation.assigned_to}` : 'Assumir conversa'}
            >
              <UserCheck className="h-4 w-4" />
              Assumir
            </Button>
          )}

          {selectedConversation && (() => {
            const isActive = ['pending', 'open'].includes(currentStatus);
            return (
              <>
                <ChatCrmButton
                  conversationId={selectedConversation.id}
                  contact={contact}
                  codAgent={selectedConversation?.cod_agent || (contact as any).cod_agent || null}
                  queueId={selectedConversation?.queue_id || null}
                />

                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'gap-1.5',
                    phoneReady
                      ? 'bg-green-50 text-green-700 border-green-500 hover:bg-green-100 hover:text-green-800'
                      : 'text-muted-foreground border-border hover:bg-muted'
                  )}
                  onClick={() => setShowPhoneCall(true)}
                  title={phoneReady ? 'Ligar (ramal disponível)' : 'Ligar (ramal indisponível)'}
                >
                  {phoneReady ? <Phone className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
                  Ligar
                </Button>

                <div className="inline-flex items-center gap-0.5 border rounded px-1 py-0.5">
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
                    className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-40"
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
                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
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
                      <DropdownMenuItem onClick={() => setShowScheduledList(true)}>
                        <Calendar className="h-4 w-4 mr-2" />
                        Mensagens agendadas
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowHelp(true)}>
                        <Keyboard className="h-4 w-4 mr-2" />
                        Atalhos de teclado
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

              </>
            );
          })()}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-3 pb-2 flex justify-end">
        <CrmActionBar
          phone={contact.phone}
          queueId={selectedConversation?.queue_id}
          contactName={contact.name}
        />
      </div>
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

      {/* Keyboard shortcuts help */}
      <KeyboardShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />

      {/* Phone call */}
      <PhoneCallDialog
        open={showPhoneCall}
        onOpenChange={setShowPhoneCall}
        whatsappNumber={contact.phone}
        contactName={contact.name}
        codAgent={queueLink?.codAgent ?? ''}
      />
    </>
  );
}