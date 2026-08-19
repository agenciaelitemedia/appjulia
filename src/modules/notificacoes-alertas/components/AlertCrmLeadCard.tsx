import { useState } from 'react';
import { Clock, Eye, Hash, MessageCircle, PhoneCall, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDbDateTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import {
  ChatSidePanel,
  useAgentChatTarget,
  useAgentAliases,
  PhoneCallDialog,
  usePhone,
  WavoipCallButton,
} from '../extend/crm';
import type { AlertCrmCard } from '../types';

interface Props {
  card: AlertCrmCard;
  onClick: () => void;
}

export function AlertCrmLeadCard({ card, onClick }: Props) {
  const { getAlias } = useAgentAliases();
  const { isAvailable } = usePhone();
  const [chatOpen, setChatOpen] = useState(false);
  const [phoneCallOpen, setPhoneCallOpen] = useState(false);
  const { target: chatTarget, isLoading: chatLoading } = useAgentChatTarget(
    card.cod_agent,
    card.lead_phone || '',
    chatOpen,
  );

  const voipUnavailable = !isAvailable || !card.lead_phone;

  const timeInStage = formatDistanceToNow(new Date(card.stage_entered_at), {
    addSuffix: false,
    locale: ptBR,
  });

  return (
    <>
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-tight line-clamp-2">
              {card.lead_name || 'Sem nome'}
            </p>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {timeInStage}
            </Badge>
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <PhoneCall className="h-3 w-3 shrink-0" />
              {card.lead_phone || '—'}
            </p>
            <p className="flex items-center gap-1.5 truncate">
              <Hash className="h-3 w-3 shrink-0" />
              {getAlias?.(card.cod_agent) || card.business_name || `[${card.cod_agent}]`}
            </p>
            <p className="flex items-center gap-1.5 truncate">
              <User className="h-3 w-3 shrink-0" />
              {card.crm_stage_label || 'Sem etapa'}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 shrink-0" />
              {formatDbDateTime(card.created_at)}
            </p>
          </div>

          <TooltipProvider>
            <div className="flex flex-wrap items-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 rounded-full text-green-600 border-green-500/40"
                    onClick={() => setChatOpen(true)}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir conversa no chat</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className={cn(
                      'h-7 w-7 rounded-full',
                      voipUnavailable
                        ? 'opacity-60 text-muted-foreground border-border hover:bg-muted'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-500 hover:bg-emerald-100',
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhoneCallOpen(true);
                    }}
                    disabled={voipUnavailable}
                    title={voipUnavailable ? 'VOIP Call indisponível' : 'Ligar via ramal'}
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{voipUnavailable ? 'VOIP Call indisponível' : 'Ligar via ramal'}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <WavoipCallButton
                      phone={card.lead_phone}
                      contactName={card.lead_name}
                      iconOnly
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{!card.lead_phone ? 'ZAP Call indisponível' : 'Iniciar ZAP Call'}</TooltipContent>
              </Tooltip>


              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 rounded-full"
                    onClick={onClick}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Detalhes e ações de recuperação</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {chatOpen && (
        <ChatSidePanel
          open={chatOpen}
          onOpenChange={setChatOpen}
          target={chatTarget ?? null}
          isLoading={chatLoading}
          title={card.lead_name || card.lead_phone || 'Conversa'}
          emptyDescription="Nenhuma conversa encontrada para este lead."
        />
      )}

      {card.lead_phone && (
        <PhoneCallDialog
          open={phoneCallOpen}
          onOpenChange={setPhoneCallOpen}
          whatsappNumber={card.lead_phone}
          contactName={card.lead_name || 'Sem nome'}
          codAgent={card.cod_agent}
        />
      )}
    </>
  );
}
