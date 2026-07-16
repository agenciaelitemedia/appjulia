import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Scale, ExternalLink, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  getChatLink,
  getJuliaLink,
  useChatConversationPreview,
  useJuliaCardPreview,
} from '../../hooks/useCardLinks';
import type { CRMDeal } from '../../types';
import { CRMLeadDetailsDialog } from '@/pages/crm/components/CRMLeadDetailsDialog';
import { useCRMStages } from '@/pages/crm/hooks/useCRMData';
import type { CRMCard } from '@/pages/crm/types';
import { setPendingSelection, type PendingTab } from '@/lib/chat/pendingSelection';

interface Props { deal: CRMDeal }

export function DealLinksSection({ deal }: Props) {
  const navigate = useNavigate();
  const chat = getChatLink(deal);
  const julia = getJuliaLink(deal);

  const chatPreview = useChatConversationPreview(chat?.conversation_id, chat?.contact_id);
  const juliaPreview = useJuliaCardPreview(julia);
  const { data: stages = [] } = useCRMStages();

  const [juliaOpen, setJuliaOpen] = useState(false);

  if (!chat && !julia) return null;

  const handleOpenChat = () => {
    const conv = chatPreview.data as
      | { id: string; contact_id: string | null; queue_id: string | null; status: string | null }
      | null
      | undefined;
    const contactId = conv?.contact_id ?? chat?.contact_id ?? null;
    if (!contactId) return;
    const statusToTab = (s: string | null | undefined): PendingTab | null => {
      if (s === 'pending') return 'pending';
      if (s === 'open' || s === 'in_progress') return 'open';
      if (s === 'resolved' || s === 'closed') return 'resolved_closed';
      return null;
    };
    setPendingSelection({
      contactId,
      queueId: conv?.queue_id ?? null,
      conversationId: conv?.id ?? chat?.conversation_id ?? null,
      tab: statusToTab(conv?.status ?? null),
    });
    navigate('/chat');
  };

  // Build a CRMCard shape for the Julia dialog from preview
  const juliaCardShape: CRMCard | null = juliaPreview.data
    ? {
        id: juliaPreview.data.id,
        cod_agent: juliaPreview.data.cod_agent,
        contact_name: juliaPreview.data.contact_name || '',
        whatsapp_number: juliaPreview.data.whatsapp_number,
        business_name: juliaPreview.data.business_name || undefined,
        stage_id: juliaPreview.data.stage_id,
        stage_name: juliaPreview.data.stage_name || undefined,
        stage_color: juliaPreview.data.stage_color || undefined,
        created_at: juliaPreview.data.updated_at || new Date().toISOString(),
        updated_at: juliaPreview.data.updated_at || new Date().toISOString(),
        stage_entered_at: juliaPreview.data.updated_at || new Date().toISOString(),
      }
    : null;

  return (
    <>
      <Separator />
      <div>
        <h4 className="text-sm font-medium mb-3">
          {chat && julia
            ? 'Vinculado ao Chat e ao CRM da Julia'
            : chat
              ? 'Vinculado ao Chat'
              : 'Vinculado ao CRM da Julia'}
        </h4>
        <div className="space-y-2">
          {chat && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-blue-500/5 border-blue-500/20">
              <div className="h-9 w-9 rounded-md bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {chat.contact_name || chat.contact_phone || 'Conversa do chat'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {chatPreview.isLoading
                    ? 'Carregando...'
                    : chatPreview.data
                      ? `${chatPreview.data.protocol || ''} · ${chatPreview.data.status || ''}`
                      : 'Conversa indisponível'}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleOpenChat} disabled={!chat.conversation_id}>
                <ExternalLink className="h-3 w-3 mr-1" /> Abrir
              </Button>
            </div>
          )}

          {julia && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-purple-500/5 border-purple-500/20">
              <div className="h-9 w-9 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Scale className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  Lead Julia · #{julia.card_id}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {juliaPreview.isLoading ? (
                    <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> carregando</span>
                  ) : (
                    juliaPreview.data?.stage_name || julia.stage_name || 'Sem etapa'
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setJuliaOpen(true)} disabled={!juliaPreview.data}>
                <ExternalLink className="h-3 w-3 mr-1" /> Ver
              </Button>
            </div>
          )}
        </div>
      </div>

      {juliaCardShape && (
        <CRMLeadDetailsDialog
          card={juliaCardShape}
          stages={stages}
          open={juliaOpen}
          onOpenChange={setJuliaOpen}
        />
      )}
    </>
  );
}