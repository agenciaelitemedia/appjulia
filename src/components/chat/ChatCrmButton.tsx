import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Kanban, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useChatDealLink } from '@/hooks/useChatDealLink';
import { CreateCrmCardSheet } from './CreateCrmCardSheet';
import { ChatLinkedDealSheet } from './ChatLinkedDealSheet';
import type { ChatContact } from '@/types/chat';

interface Props {
  conversationId: string | null;
  contact: ChatContact;
  codAgent?: string | null;
  queueId?: string | null;
}

export function ChatCrmButton({ conversationId, contact, codAgent, queueId }: Props) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  const { data: deal, isLoading } = useChatDealLink(
    conversationId,
    clientId,
    contact?.id ?? null,
    contact?.phone ?? null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [linkedOpen, setLinkedOpen] = useState(false);

  const isLinked = !!deal;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => (isLinked ? setLinkedOpen(true) : setCreateOpen(true))}
        className={cn(
          'gap-1.5',
          isLinked && 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100 hover:text-blue-800'
        )}
        title={isLinked ? `Ver card no CRM · ${deal?.pipeline?.name ?? ''}` : 'Criar card no CRM'}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Kanban className={cn('h-3.5 w-3.5', !isLinked && 'text-primary')} />
        )}
        <span>CRM</span>
      </Button>

      <CreateCrmCardSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        contact={contact}
        codAgent={codAgent || null}
        queueId={queueId || null}
        conversationId={conversationId || null}
      />

      {deal && (
        <ChatLinkedDealSheet
          open={linkedOpen}
          onOpenChange={setLinkedOpen}
          deal={deal}
        />
      )}
    </>
  );
}