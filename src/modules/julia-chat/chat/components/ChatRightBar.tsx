import { Button } from '@/components/ui/button';
import { PanelRightClose, Info, Kanban, Loader2, Eye, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWhatsAppData } from '@/modules/julia-chat/chat/contexts/WhatsAppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChatDealLink } from '@/hooks/useChatDealLink';
import { ContactDetailPanel } from './ContactDetailPanel';
import { CreateCrmCardSheet } from './CreateCrmCardSheet';
import { ChatLinkedDealSheet } from './ChatLinkedDealSheet';
import { CrmActionBar } from './CrmActionBar';
import { useQueueAgentLink } from '@/hooks/useQueueAgentLink';
import { useCRMCardByWhatsapp, useCRMStages } from '@/pages/crm/hooks/useCRMData';
import { CRMLeadDetailsDialog } from '@/pages/crm/components/CRMLeadDetailsDialog';
import { ChatContactCallsPanel } from '@/modules/julia-chat/chat/components/ChatContactCallsPanel';
import type { ChatContact } from '@/types/chat';

interface ChatRightBarProps {
  contact: ChatContact;
  onClose: () => void;
  className?: string;
}

/**
 * Coluna lateral direita fixa do chat. Reúne os detalhes do contato e o card
 * do CRM vinculado (ou o formulário de criação) em abas, no lugar dos overlays.
 */
export function ChatRightBar({ contact, onClose, className }: ChatRightBarProps) {
  const { selectedConversation, rightBarTab, setRightBarTab } = useWhatsAppData();
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  const conversationId = selectedConversation?.id ?? null;
  const codAgent = selectedConversation?.cod_agent || (contact as any)?.cod_agent || null;
  const queueId = selectedConversation?.queue_id || null;

  const { data: deal, isLoading: dealLoading } = useChatDealLink(
    conversationId,
    clientId,
    contact?.id ?? null,
    contact?.phone ?? null,
  );

  const { data: queueLink } = useQueueAgentLink(queueId);
  const leadCodAgent = queueLink?.codAgent ?? null;
  const { data: crmCard, isLoading: leadLoading } = useCRMCardByWhatsapp(
    leadCodAgent ? contact?.phone || null : null,
  );
  const { data: stages = [] } = useCRMStages();

  const tabs: { id: 'contact' | 'crm' | 'lead' | 'phone'; label: string; icon: typeof Info }[] = [
    { id: 'contact', label: 'Contato', icon: Info },
    { id: 'crm', label: 'CRM', icon: Kanban },
    { id: 'phone', label: 'Telefonia', icon: Phone },
    ...(leadCodAgent ? [{ id: 'lead' as const, label: 'Lead', icon: Eye }] : []),
  ];

  return (
    <aside
      className={cn(
        'flex flex-col h-full min-h-0 border-l bg-card/60 backdrop-blur-md aj-content-glass',
        className,
      )}
    >
      <div className="flex items-center gap-1 p-2 border-b">
        {tabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={rightBarTab === t.id ? 'secondary' : 'ghost'}
            className="gap-1.5 flex-1"
            onClick={() => setRightBarTab(t.id)}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </Button>
        ))}
        <Button size="icon" variant="ghost" onClick={onClose} title="Fechar painel">
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-2 py-2 border-b flex justify-center empty:hidden empty:border-0 empty:p-0">
        <CrmActionBar
          phone={contact?.phone || ''}
          queueId={queueId}
          contactName={contact?.name || ''}
        />
      </div>


      <div className="flex-1 min-h-0 overflow-hidden">
        {rightBarTab === 'contact' ? (
          <ContactDetailPanel contact={contact} onClose={onClose} hideHeaderClose />
        ) : rightBarTab === 'phone' ? (
          <ChatContactCallsPanel phone={contact?.phone || null} />
        ) : rightBarTab === 'lead' ? (
          leadLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : crmCard ? (
            <div className="h-full px-3 py-3">
              <CRMLeadDetailsDialog
                variant="inline"
                card={crmCard}
                stages={stages}
                open
                onOpenChange={(o) => {
                  if (!o) setRightBarTab('contact');
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full px-6 text-center text-sm text-muted-foreground">
              Este contato ainda não possui card no CRM da Julia.
            </div>
          )
        ) : dealLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : deal ? (
          <ChatLinkedDealSheet
            variant="inline"
            open
            onOpenChange={(o) => {
              if (!o) setRightBarTab('contact');
            }}
            deal={deal}
          />
        ) : (
          <CreateCrmCardSheet
            variant="inline"
            open
            onOpenChange={(o) => {
              if (!o) setRightBarTab('contact');
            }}
            contact={contact}
            codAgent={codAgent}
            queueId={queueId}
            conversationId={conversationId}
          />
        )}
      </div>
    </aside>
  );
}
