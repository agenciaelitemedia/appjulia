import React, { useState } from 'react';
import { ChevronDown, UserPlus, ArrowRightLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TransferDialog } from './TransferDialog';
import { CSATDialog } from './CSATDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { useAutoSummaryOnStatusChange } from '@/hooks/useAutoSummaryOnStatusChange';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ChatConversation } from '@/types/conversation';

interface Props {
  conversation: ChatConversation;
}

export function ConversationQuickActions({ conversation }: Props) {
  const { user } = useAuth();
  const { assignConversation, updateConversationStatus, sendInternalNote } = useWhatsAppData();
  const { triggerAutoSummary } = useAutoSummaryOnStatusChange();
  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentUserName = user?.name || (user?.id ? String(user.id) : '');

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const handleAssume = async (e: React.MouseEvent) => {
    stop(e);
    if (!currentUserName) {
      toast.error('Usuário não identificado.');
      return;
    }
    setBusy(true);
    try {
      await assignConversation(conversation.id, currentUserName);
      if (conversation.status === 'pending') {
        await updateConversationStatus(conversation.id, 'open');
      }
      toast.success('Conversa assumida');
    } catch (err: any) {
      toast.error(`Não foi possível assumir: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmClose = async (closeNote: string, _sendSurvey: boolean) => {
    const trimmedNote = (closeNote || '').trim();
    if (trimmedNote) {
      try {
        await sendInternalNote(
          conversation.contact_id,
          trimmedNote,
          currentUserName || 'Sistema',
          { noteType: 'urgent', extraMetadata: { closure_note: true } },
        );
      } catch (e) {
        console.warn('[close] failed to post closure internal note', e);
      }
    }
    try {
      await updateConversationStatus(conversation.id, 'closed', closeNote || undefined);
      triggerAutoSummary(conversation.id, 'auto_close');
      toast.success('Conversa encerrada');
    } catch (err: any) {
      toast.error(`Não foi possível encerrar: ${err?.message || err}`);
      throw err;
    }
  };

  const handleTransferConfirm = async (assignedTo: string) => {
    try {
      await assignConversation(conversation.id, assignedTo);
      toast.success('Conversa transferida');
    } catch (err: any) {
      toast.error(`Não foi possível transferir: ${err?.message || err}`);
      throw err;
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={stop}
            onPointerDown={stop}
            disabled={busy}
            aria-label="Ações da conversa"
            className={cn(
              'h-5 w-5 p-0 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent',
              'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
              open && 'opacity-100',
            )}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52"
          onClick={stop}
          onPointerDown={stop}
        >
          <DropdownMenuItem onClick={handleAssume}>
            <UserPlus className="h-4 w-4 mr-2" />
            Assumir conversa
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              stop(e);
              setTransferOpen(true);
            }}
          >
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transferir conversa
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              stop(e);
              setCloseOpen(true);
            }}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Encerrar conversa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onTransfer={handleTransferConfirm}
      />

      <CSATDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        conversationId={conversation.id}
        contactId={conversation.contact_id}
        clientId={conversation.client_id}
        codAgent={conversation.cod_agent}
        onConfirm={handleConfirmClose}
      />
    </>
  );
}