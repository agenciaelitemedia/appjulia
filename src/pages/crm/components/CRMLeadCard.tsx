import { useState, useRef, useEffect } from 'react';
import { Bot, Check, Clock, Eye, Hash, Loader2, MessageCircle, Pencil, Phone, Scale, User, Video, X } from 'lucide-react';
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
import { PhoneCallDialog } from './PhoneCallDialog';
import { ChatSidePanel } from '@/components/chat/ChatSidePanel';
import { useAgentChatTarget } from '@/hooks/useAgentChatTarget';
import { formatDbDateTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentSessionStatus } from '@/hooks/useAgentSessionStatus';
import { useAgentAliases } from '@/hooks/useAgentAliases';
import { useUpdateCardName } from '../hooks/useCRMData';
import { toast } from 'sonner';

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
  const { getAlias } = useAgentAliases();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [phoneCallOpen, setPhoneCallOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(card.contact_name || '');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Quando o agente do card está vinculado a uma fila, usamos o painel
  // reusável (mesmo do CRM Builder) em vez do dialog UaZapi direto.
  const { isLinked: agentHasQueue, target: chatTarget, isLoading: chatTargetLoading } = useAgentChatTarget(
    card.cod_agent,
    card.whatsapp_number,
  );
  const updateCardName = useUpdateCardName();
  const { isActive: isAgentActive, isLoading: isAgentLoading, invalidate: refreshAgentStatus } = useAgentSessionStatus(
    card.whatsapp_number,
    card.cod_agent
  );

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

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
    if (agentHasQueue) {
      setChatPanelOpen(true);
    } else {
      setMessagesOpen(true);
    }
  };

  const handleContract = (e: React.MouseEvent) => {
    e.stopPropagation();
    setContractOpen(true);
  };

  const handleVideoCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVideoCallOpen(true);
  };

  const handlePhoneCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhoneCallOpen(true);
  };

  const handleSessionStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionOpen(true);
  };

  const handleSessionClose = (open: boolean) => {
    setSessionOpen(open);
    if (!open) refreshAgentStatus();
  };

  const handleStartEditName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(card.contact_name || '');
    setIsEditingName(true);
  };

  const handleSaveName = (e: React.MouseEvent) => {
    e.stopPropagation();
    const trimmed = editName.trim();
    if (!trimmed || trimmed === card.contact_name) {
      setIsEditingName(false);
      return;
    }
    updateCardName.mutate(
      { cardId: card.id, contactName: trimmed },
      {
        onSuccess: () => {
          toast.success('Nome atualizado');
          setIsEditingName(false);
        },
        onError: () => toast.error('Erro ao atualizar nome'),
      }
    );
  };

  const handleCancelEditName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingName(false);
  };

  const agentAlias = card.cod_agent ? getAlias(card.cod_agent, card.owner_business_name) : '';
  const truncatedAlias = truncateText(agentAlias, 20);
  const fullTooltip = card.owner_name || card.owner_business_name
    ? `${card.owner_name || ''}${card.owner_name && card.owner_business_name ? ' • ' : ''}${card.owner_business_name || ''}${agentAlias ? ` • ${agentAlias}` : ''}`
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

            {/* Header with name and details button */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden flex-1">
                {isEditingName ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName(e as any);
                        if (e.key === 'Escape') handleCancelEditName(e as any);
                      }}
                      className="text-sm font-medium bg-muted border border-input rounded px-1.5 py-0.5 w-full min-w-0 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-green-600 hover:text-green-700" onClick={handleSaveName} disabled={updateCardName.isPending}>
                      {updateCardName.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={handleCancelEditName}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-sm font-medium group/name">
                    <span className="text-primary">👤</span>
                    <span className="line-clamp-1">{card.contact_name || 'Sem nome'}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={handleStartEditName}
                      title="Editar nome"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <span className="text-xs text-muted-foreground pl-5">{card.whatsapp_number}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                onClick={handleDetails}
                title="Ver detalhes"
              >
                <Eye className="h-4 w-4" />
              </Button>
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
                        {truncatedAlias && <span className="text-muted-foreground"> - {truncatedAlias}</span>}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{fullTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            {/* Action badges bar */}
            <div className="flex items-center gap-1 flex-wrap">
              {/* Contract */}
              {card.has_contract_history && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded-full",
                          isContractSigned
                            ? "text-green-500 border-green-500/30 hover:bg-green-100/50 dark:hover:bg-green-900/30"
                            : "text-cyan-500 border-cyan-500/30 hover:bg-cyan-100/50 dark:hover:bg-cyan-900/30"
                        )}
                        onClick={handleContract}
                      >
                        <Scale className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isContractSigned ? 'Contrato Assinado' : 'Contrato em Curso'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Video Call */}
              {canStartVideoCall && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 rounded-full text-blue-500 border-blue-500/30 hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
                        onClick={handleVideoCall}
                      >
                        <Video className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Videochamada</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Phone Call */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-full text-orange-500 border-orange-500/30 hover:bg-orange-100/50 dark:hover:bg-orange-900/30"
                      onClick={handlePhoneCall}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Ligar via ramal</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {/* WhatsApp */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-full text-green-500 border-green-500/30 hover:bg-green-100/50 dark:hover:bg-green-900/30"
                      onClick={handleWhatsApp}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Mensagens WhatsApp</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {/* Bot Status */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-7 w-7 rounded-full",
                        isAgentLoading
                          ? "text-muted-foreground border-muted"
                          : isAgentActive === null
                            ? "text-muted-foreground border-muted"
                            : isAgentActive
                              ? "text-green-500 border-green-500/30 hover:bg-green-100/50 dark:hover:bg-green-900/30"
                              : "text-red-500 border-red-500/30 hover:bg-red-100/50 dark:hover:bg-red-900/30"
                      )}
                      onClick={handleSessionStatus}
                    >
                      {isAgentLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Bot className={cn("h-3.5 w-3.5", isAgentActive && "animate-pulse")} />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {isAgentLoading ? 'Verificando...' : isAgentActive === null ? 'Verificando...' : isAgentActive ? 'Julia Ativa' : 'Julia Inativa'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>


            {/* Responsável */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Responsável:</span>
              {isAgentLoading ? (
                <span className="text-muted-foreground/50">...</span>
              ) : isAgentActive ? (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                  <Bot className="h-3 w-3" />
                  Julia IA
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {card.owner_name || 'Sem responsável'}
                </span>
              )}
            </div>

            {/* Dates and time in stage */}
            <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Atualizado:</span>
                <span>{formatDbDateTime(card.updated_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Criado:</span>
                <span>{formatDbDateTime(card.created_at)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground/70 pt-1">
                <Clock className="h-3 w-3" />
                <span>Na fase: {timeInStage}</span>
              </div>
              {/* FollowUp indicator */}
              {followupInfo && (
                <div className="flex items-center gap-1.5 pt-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 cursor-help">
                          <span className="relative z-10 animate-pulse">⏳</span>
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
              )}
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
        variant="sheet"
      />

      {/* Painel de chat reusável (quando o agente tem fila vinculada) */}
      <ChatSidePanel
        open={chatPanelOpen}
        onOpenChange={setChatPanelOpen}
        target={chatTarget}
        isLoading={chatTargetLoading}
        title="Conversa do lead"
        emptyDescription="Nenhuma conversa encontrada na fila vinculada para este telefone."
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

      {/* Session Status Dialog */}
      <SessionStatusDialog
        open={sessionOpen}
        onOpenChange={handleSessionClose}
        whatsappNumber={card.whatsapp_number}
        codAgent={card.cod_agent}
      />

      {/* Phone Call Dialog */}
      <PhoneCallDialog
        open={phoneCallOpen}
        onOpenChange={setPhoneCallOpen}
        whatsappNumber={card.whatsapp_number}
        contactName={card.contact_name}
        codAgent={card.cod_agent}
      />
    </>
  );
}
