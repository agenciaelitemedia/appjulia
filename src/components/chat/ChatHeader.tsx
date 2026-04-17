import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Users, Info, X, CheckCircle2, XCircle, ArrowRightLeft, Clock, MessageSquare, MessageCircle, Globe, Instagram, Search, Calendar, BellOff, Keyboard, Sparkles, UserCheck } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useConversationPresence } from '@/hooks/useConversationPresence';
import { useChatKeyboardShortcuts } from '@/hooks/useChatKeyboardShortcuts';
import { cn } from '@/lib/utils';
import type { ChatContact } from '@/types/chat';
import { TransferDialog } from './TransferDialog';
import { CSATDialog } from './CSATDialog';
import { PresenceIndicator } from './PresenceIndicator';
import { ChatSearchDialog } from './ChatSearchDialog';
import { ScheduledMessagesList } from './ScheduledMessagesList';
import { SnoozeDialog } from './SnoozeDialog';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { CreateCrmLeadDialog } from './CreateCrmLeadDialog';
import { AIAssistPanel } from './AIAssistPanel';

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

export function ChatHeader({ contact, onClose, onShowDetails }: ChatHeaderProps) {
  const { selectedConversation, updateConversationStatus, assignConversation, filteredContacts, selectedContactId, selectContact } = useWhatsAppData();
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
  };
  const { user } = useAuth();
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showScheduledList, setShowScheduledList] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showCrmLead, setShowCrmLead] = useState(false);

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
  };

  const handleResolve = async () => {
    if (!selectedConversation) return;
    await updateConversationStatus(selectedConversation.id, 'resolved');
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
      <div className="flex items-center gap-3 p-3 border-b bg-background">
        <Avatar className="h-10 w-10">
          <AvatarImage src={contact.avatar} alt={contact.name} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {contact.is_group ? <Users className="h-4 w-4" /> : initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{contact.name}</h3>
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
            {selectedConversation && (
              <ChannelBadge channel={selectedConversation.channel} />
            )}
            <PresenceIndicator users={presenceUsers} meId={user?.id ? String(user.id) : null} />
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* AI Assist */}
          {selectedConversation && (
            <AIAssistPanel conversationId={selectedConversation.id} />
          )}

          {/* Search inside conversation */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSearch(true)}
            title="Buscar nesta conversa"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Scheduled messages */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowScheduledList(true)}
            title="Mensagens agendadas"
          >
            <Calendar className="h-4 w-4" />
          </Button>

          {/* Quick action buttons for conversation */}
          {selectedConversation && ['pending', 'open'].includes(currentStatus) && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={() => setShowSnooze(true)}
                title="Adiar conversa (z)"
              >
                <BellOff className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                onClick={() => setShowTransferDialog(true)}
                title="Transferir conversa (#)"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={handleResolve}
                title="Marcar como resolvida (e)"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowCloseDialog(true)}
                title="Encerrar conversa"
              >
                <XCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowHelp(true)}
                title="Atalhos de teclado (?)"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </>
          )}

          {selectedConversation && ['closed', 'resolved'].includes(currentStatus) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={handleReopen}
            >
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
              Reabrir
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onShowDetails}>
                <Info className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowCrmLead(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Criar lead no CRM
              </DropdownMenuItem>
              {selectedConversation && ['pending', 'open'].includes(currentStatus) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowTransferDialog(true)}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Transferir
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleResolve}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Marcar como resolvida
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowCloseDialog(true)} className="text-destructive">
                    <XCircle className="h-4 w-4 mr-2" />
                    Encerrar conversa
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <CreateCrmLeadDialog
            open={showCrmLead}
            onOpenChange={setShowCrmLead}
            contact={contact}
            codAgent={selectedConversation?.cod_agent || (contact as any).cod_agent || null}
            conversationId={selectedConversation?.id || null}
          />
          
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
    </>
  );
}