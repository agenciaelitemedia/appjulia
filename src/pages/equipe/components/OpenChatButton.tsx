import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChatSidePanel } from '@/components/chat/ChatSidePanel';
import { useChatTargetByConversation, useChatTargetByPhone } from '../hooks/useChatTarget';

type Props =
  | { conversationId: string | null; phone?: never }
  | { phone: string | null; conversationId?: never };

export function OpenChatButton(props: Props) {
  const [open, setOpen] = useState(false);
  const byConv = useChatTargetByConversation(
    'conversationId' in props ? props.conversationId ?? null : null,
    open,
  );
  const byPhone = useChatTargetByPhone(
    'phone' in props ? props.phone ?? null : null,
    open,
  );
  const active = 'conversationId' in props ? byConv : byPhone;

  const disabled =
    'conversationId' in props ? !props.conversationId : !('phone' in props && props.phone);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/40"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            aria-label="Abrir conversa"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Abrir conversa</TooltipContent>
      </Tooltip>

      <ChatSidePanel
        open={open}
        onOpenChange={setOpen}
        target={active.data ?? null}
        isLoading={active.isLoading}
        emptyDescription="Nenhuma conversa encontrada para este contato."
      />
    </>
  );
}