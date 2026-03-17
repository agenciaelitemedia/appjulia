import { useState, useEffect, useCallback } from 'react';
import { Bot, Clock, Eye, Hash, MessageCircle, Scale, Video } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CRMCard } from '../types';
 import { CRMFollowupInfo } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WhatsAppMessagesDialog } from './WhatsAppMessagesDialog';
import { ContractInfoDialog } from './ContractInfoDialog';
import { SessionStatusDialog } from './SessionStatusDialog';
import { VideoCallDialog } from '@/pages/video/components/VideoCallDialog';
import { externalDb } from '@/lib/externalDb';
import { formatDbDateTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface CRMLeadCardProps {
  card: CRMCard;
  onClick: () => void;
  apiCredentials?: {
    apiUrl: string;
    apiKey: string;
    apiInstance: string;
  };
   followupInfo?: CRMFollowupInfo;
}

function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

 export function CRMLeadCard({ card, onClick, apiCredentials, followupInfo }: CRMLeadCardProps) {
  const { user } = useAuth();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState<boolean | null>(null);

  const fetchAgentStatus = useCallback(async () => {
    if (!card.whatsapp_number || !card.cod_agent) return;
    try {
      const result = await externalDb.getSessionStatus(card.whatsapp_number, card.cod_agent);
      setIsAgentActive(result?.active ?? false);
    } catch {
      setIsAgentActive(false);
    }
  }, [card.whatsapp_number, card.cod_agent]);

  useEffect(() => {
    fetchAgentStatus();
  }, [fetchAgentStatus]);

  // Video call only visible for admin and colaborador roles
  const canStartVideoCall = user?.role === 'admin' || user?.role === 'colaborador';
  
  const timeInStage = formatDistanceToNow(new Date(card.stage_entered_at), {
    addSuffix: false,
    locale: ptBR,
  });

  const handleDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMessagesOpen(true);
  };

  const handleContract = (e: React.MouseEvent) => {
    e.stopPropagation();
    setContractOpen(true);
  };

  const handleVideoCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVideoCallOpen(true);
  };

  const handleSessionStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionOpen(true);
  };

  const handleSessionClose = (open: boolean) => {
    setSessionOpen(open);
    if (!open) fetchAgentStatus();
  };

  const truncatedBusinessName = truncateText(card.owner_business_name, 20);
  const fullTooltip = card.owner_name || card.owner_business_name
    ? `${card.owner_name || ''}${card.owner_name && card.owner_business_name ? ' • ' : ''}${card.owner_business_name || ''}`
    : card.cod_agent;

  // Determine contract status based on stage name
  const isContractSigned = card.stage_name === 'Contrato Assinado';
  const isContractInProgress = card.stage_name === 'Contrato em Curso';

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
        style={{ borderLeftColor: card.stage_color || '#6B7280' }}
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="space-y-2">

            {/* Header with name and actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="text-primary">👤</span>
                  <span className="line-clamp-1">{card.contact_name || 'Sem nome'}</span>
                </div>
                <span className="text-xs text-muted-foreground pl-5">{card.whatsapp_number}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Contract Icon - only for leads with contract history */}
                {card.has_contract_history && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7 relative transition-all duration-300",
                            "hover:scale-110",
                            isContractSigned
                              ? "text-green-500 hover:bg-green-100/50 dark:hover:bg-green-900/30"
                              : "text-cyan-500 hover:bg-cyan-100/50 dark:hover:bg-cyan-900/30",
                            "before:absolute before:inset-0 before:rounded-full before:animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]",
                            isContractSigned
                              ? "before:bg-green-400/40"
                              : "before:bg-cyan-400/40",
                            "after:absolute after:inset-[-4px] after:rounded-full after:animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]",
                            isContractSigned
                              ? "after:bg-green-300/20"
                              : "after:bg-cyan-300/20"
                          )}
                          onClick={handleContract}
                        >
                          <Scale className="h-4 w-4 relative z-10 animate-pulse" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isContractSigned ? 'Contrato Assinado' : 'Contrato em Curso'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* Video Call Button - only for admin and colaborador */}
                {canStartVideoCall && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
                          onClick={handleVideoCall}
                          title="Videochamada"
                        >
                          <Video className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Iniciar videochamada</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100/50 dark:hover:bg-green-900/30"
                        onClick={handleWhatsApp}
                        title="Ver mensagens"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ver mensagens do WhatsApp</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={handleDetails}
                  title="Ver detalhes"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Cod Agent badge with tooltip */}
            {card.cod_agent && (
              <div className="flex items-center gap-1.5">
                <Hash className="h-3 w-3 text-muted-foreground" />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-[10px] font-normal truncate max-w-full cursor-default">
                        <span className="font-semibold">[{card.cod_agent}]</span>
                        {truncatedBusinessName && <span className="text-muted-foreground"> - {truncatedBusinessName}</span>}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{fullTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            {/* Dates and time in stage */}
            <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Criado:</span>
                <span>{formatDbDateTime(card.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Atualizado:</span>
                <span>{formatDbDateTime(card.updated_at)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground/70 pt-1">
                <Clock className="h-3 w-3" />
                <span>Na fase: {timeInStage}</span>
              </div>
              {/* FollowUp indicator + Timezone indicator */}
              <div className="flex items-center justify-between pt-1">
                {followupInfo ? (
                  <div className="flex items-center gap-1.5">
                   <TooltipProvider>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <div className="flex items-center gap-1.5 cursor-help">
                    <span 
                      className={cn(
                        "relative transition-all duration-300",
                        followupInfo.step_number === 0 
                          ? "text-red-500" 
                          : "text-green-500",
                        "before:absolute before:inset-0 before:rounded-full before:animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]",
                        followupInfo.step_number === 0
                          ? "before:bg-red-400/40"
                          : "before:bg-green-400/40",
                        "after:absolute after:inset-[-4px] after:rounded-full after:animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]",
                        followupInfo.step_number === 0
                          ? "after:bg-red-300/20"
                          : "after:bg-green-300/20"
                      )}
                    >
                      <span className="relative z-10 animate-pulse">⏳</span>
                    </span>
                    <Badge 
                      variant="outline" 
                      className={followupInfo.step_number === 0 
                        ? "text-[10px] font-medium px-1.5 py-0 bg-red-500/10 text-red-600 border-red-500/30"
                        : "text-[10px] font-medium px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/30"
                      }
                    >
                     {followupInfo.step_number === 0 ? followupInfo.stage_label : `Etapa ${followupInfo.stage_label}`}
                    </Badge>
                         </div>
                       </TooltipTrigger>
                       <TooltipContent side="top" className="max-w-[250px] text-center">
                         <div className="space-y-1">
                           <p className="text-xs font-bold">Indicador de Follow-up</p>
                           <p className="text-xs">{followupInfo.tooltip_text}</p>
                         </div>
                       </TooltipContent>
                     </Tooltip>
                   </TooltipProvider>
                  </div>
                ) : (
                  <div />
                )}
                <span className="text-[10px] text-muted-foreground/50">
                  🇧🇷 Horário de Brasília
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Messages Dialog */}
      <WhatsAppMessagesDialog
        open={messagesOpen}
        onOpenChange={setMessagesOpen}
        whatsappNumber={card.whatsapp_number}
        leadName={card.contact_name}
        codAgent={card.cod_agent}
      />

      {/* Contract Info Dialog */}
      <ContractInfoDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        whatsappNumber={card.whatsapp_number}
        codAgent={card.cod_agent}
        contactName={card.contact_name}
      />

      {/* Video Call Dialog */}
      <VideoCallDialog
        open={videoCallOpen}
        onOpenChange={setVideoCallOpen}
        leadId={card.id}
        codAgent={card.cod_agent}
        whatsappNumber={card.whatsapp_number}
        contactName={card.contact_name}
        apiCredentials={apiCredentials}
      />
    </>
  );
}
