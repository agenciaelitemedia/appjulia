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
import { useAuth } from '@/contexts/AuthContext';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ChatConversation } from '@/types/conversation';

interface Props {
  conversation: ChatConversation;
}

export function ConversationQuickActions({ conversation }: Props) {
  const { user } = useAuth();
  const { assignConversation, updateConversationStatus } = useWhatsAppData();
  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
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

  const handleClose = async (e: React.MouseEvent) => {
    stop(e);
    setBusy(true);
    try {
      await updateConversationStatus(conversation.id, 'closed');
      toast.success('Conversa encerrada');
    } catch (err: any) {
      toast.error(`Não foi possível encerrar: ${err?.message || err}`);
    } finally {
      setBusy(false);
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
          <DropdownMenuItem onClick={handleClose}>
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
    </>
  );
}