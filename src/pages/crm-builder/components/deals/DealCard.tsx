import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MoreHorizontal,
  Pencil,
  Archive,
  Trophy,
  XCircle,
  User,
  Phone,
  DollarSign,
  Clock,
  MessageSquare,
  Scale,
  MessageCircle,
  Flag,
  Inbox,
  CalendarClock,
  CheckSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CRMDeal } from '../../types';
import { PRIORITY_CONFIG } from '../../types';
import { getChatLink, getJuliaLink, useJuliaCardPreview } from '../../hooks/useCardLinks';
import { useDealConversation } from '../../hooks/useDealConversation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePhone } from '@/contexts/PhoneContext';
import { PhoneCallDialog } from '@/pages/crm/components/PhoneCallDialog';
import { useChatContactConversationStatus } from '../../hooks/useChatContactConversationStatus';
import { useDealJuliaContext } from '../../hooks/useDealJuliaContext';
import { NewConversationDialog } from '@/components/chat/NewConversationDialog';
import { useQueues } from '@/pages/agente/filas/hooks/useQueues';
import { useAuth } from '@/contexts/AuthContext';

interface DealCardProps {
  deal: CRMDeal;
  pipelineColor?: string;
  onEdit: () => void;
  onArchive: () => void;
  onWon: () => void;
  onLost: () => void;
  onClick?: () => void;
  onOpenChat?: (deal: CRMDeal) => void;
  onChangePriority?: (deal: CRMDeal, priority: 'low' | 'medium' | 'high' | 'urgent') => void;
  taskTotal?: number;
  taskDone?: number;
}

export function DealCard({
  deal,
  pipelineColor,
  onEdit,
  onArchive,
  onWon,
  onLost,
  onClick,
  onOpenChat,
  onChangePriority,
  taskTotal = 0,
  taskDone = 0,
}: DealCardProps) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [phoneCallOpen, setPhoneCallOpen] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const { isAvailable: isPhoneAvailable } = usePhone();
  const { user } = useAuth();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `deal-${deal.id}`,
    data: {
      type: 'deal',
      deal,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityConfig = PRIORITY_CONFIG[deal.priority];
  const chatLink = getChatLink(deal);
  const juliaLink = getJuliaLink(deal);
  // Live data from Julia CRM — não move o card no kanban, só atualiza badges/info.
  const juliaLive = useJuliaCardPreview(juliaLink);
  const liveJulia = juliaLive.data;
  const isLinked = !!chatLink || !!juliaLink;

  // Resolve fila e dados da conversa quando o card está vinculado ao chat
  const dealConv = useDealConversation(chatLink ? deal : null);
  const queueName = dealConv.data?.queueName ?? null;

  // Júlia context: detecta se a fila vinculada é de um agente Júlia
  const juliaCtx = useDealJuliaContext(deal);
  const isJuliaCard = juliaCtx.isJulia;

  // Status do contato no chat (somente quando NÃO há chatLink ainda e há telefone)
  const contactStatus = useChatContactConversationStatus(!chatLink ? deal.contact_phone : null);
  const showAmberWhatsapp = !chatLink && !!deal.contact_phone && !contactStatus.data?.hasConversation;

  // Filas WhatsApp para o NewConversationDialog (carregadas só sob demanda)
  const { data: allQueues = [] } = useQueues();
  const waQueues = allQueues
    .filter((q: any) => q.is_active && !q.is_deleted && q.channel_type === 'uazapi')
    .map((q: any) => ({
      id: q.id,
      name: q.name,
      evo_url: q.evo_url,
      evo_apikey: q.evo_apikey,
      evo_instance: q.evo_instance,
    }));

  // Cor do ícone de prioridade
  const priorityIconColor: Record<string, string> = {
    low: 'text-gray-400',
    medium: 'text-blue-500',
    high: 'text-orange-500',
    urgent: 'text-red-500',
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: deal.currency || 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const timeInStage = formatDistanceToNow(new Date(deal.stage_entered_at), {
    addSuffix: false,
    locale: ptBR,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  };

  return (
    <Card
      ref={setNodeRef}
      style={{
        ...style,
        borderLeftColor: pipelineColor || 'transparent',
        borderLeftWidth: pipelineColor ? '4px' : undefined,
      }}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing transition-all hover:shadow-md group border-l-4',
        isDragging && 'opacity-30 ring-2 ring-primary/50 ring-dashed bg-primary/5',
        deal.status === 'won' && 'border-l-primary bg-primary/5',
        deal.status === 'lost' && 'border-l-destructive bg-destructive/5'
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header with title and menu */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-2 flex-1">
            {deal.title}
          </h4>

          <div className="flex items-center gap-1 flex-shrink-0">
            {isPhoneAvailable && deal.contact_phone && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhoneCallOpen(true);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ligar via ramal</TooltipContent>
              </Tooltip>
            )}

            {chatLink && onOpenChat && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChat(deal);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir conversa</TooltipContent>
              </Tooltip>
            )}

            {showAmberWhatsapp && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewConvOpen(true);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Iniciar conversa no WhatsApp</TooltipContent>
              </Tooltip>
            )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isLinked && (
                <>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onWon(); }}>
                <Trophy className="h-4 w-4 mr-2 text-primary" />
                Marcar como Ganho
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onLost(); }}>
                <XCircle className="h-4 w-4 mr-2 text-destructive" />
                Marcar como Perdido
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); setConfirmArchive(true); }}
                className="text-destructive"
              >
                <Archive className="h-4 w-4 mr-2" />
                {isLinked ? 'Excluir card' : 'Arquivar'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {/* Value */}
        {deal.value > 0 && (
          <div className="flex items-center gap-1 text-sm font-semibold text-primary">
            <DollarSign className="h-3 w-3" />
            {formatCurrency(deal.value)}
          </div>
        )}

        {/* Contact info */}
        <div className="space-y-1">
          {deal.contact_name && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{deal.contact_name}</span>
            </div>
          )}
          {deal.contact_phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span className="truncate">{deal.contact_phone}</span>
            </div>
          )}
        </div>

        {/* Status row: prioridade (sempre), responsável (sempre), fila (se vinculado) */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0 gap-1 max-w-[140px]',
              deal.assigned_to
                ? 'bg-primary/5 border-primary/30 text-primary'
                : 'bg-muted text-muted-foreground border-border'
            )}
            title={deal.assigned_to || 'Não atribuído'}
          >
            <User className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{deal.assigned_to || 'Não atribuído'}</span>
          </Badge>

          {deal.due_date && (() => {
            const today = new Date().toISOString().slice(0, 10);
            const isOverdue = deal.due_date < today;
            const isToday = deal.due_date === today;
            return (
              <span className={cn('relative inline-flex', isOverdue && 'items-center')}>
                {isOverdue && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-red-500 opacity-30 pointer-events-none" />
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    'relative text-[10px] px-1.5 py-0 gap-1',
                    isOverdue
                      ? 'bg-red-500 text-white border-red-600 font-semibold shadow-sm shadow-red-500/50 animate-pulse'
                      : isToday
                      ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30'
                      : 'bg-green-500/10 text-green-700 border-green-500/30'
                  )}
                  title={isOverdue ? 'Em atraso' : isToday ? 'Vence hoje' : 'No prazo'}
                >
                  <CalendarClock className="h-2.5 w-2.5 flex-shrink-0" />
                  {format(new Date(deal.due_date + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR })}
                </Badge>
              </span>
            );
          })()}

          {taskTotal > 0 && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 gap-1',
                taskDone === taskTotal
                  ? 'bg-green-500/10 text-green-700 border-green-500/30'
                  : 'bg-muted/80 text-muted-foreground border-border'
              )}
              title={`${taskDone} de ${taskTotal} tarefas concluídas`}
            >
              <CheckSquare className="h-2.5 w-2.5 flex-shrink-0" />
              {taskDone}/{taskTotal}
            </Badge>
          )}

          {isJuliaCard && juliaCtx.codAgent && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 gap-1 bg-purple-500/10 text-purple-700 border-purple-500/30 max-w-[160px]"
              title={`Agente Jul.IA #${juliaCtx.codAgent}${juliaCtx.agentAlias ? ' - ' + juliaCtx.agentAlias : ''}`}
            >
              <Scale className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">
                #{juliaCtx.codAgent}
                {juliaCtx.agentAlias ? ` - ${juliaCtx.agentAlias}` : ''}
              </span>
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title={`Prioridade: ${priorityConfig.label} — clique para alterar`}
                className={cn(
                  'inline-flex items-center ml-auto rounded p-0.5 hover:bg-muted transition-colors',
                  priorityIconColor[deal.priority] || 'text-muted-foreground'
                )}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Flag className="h-3.5 w-3.5" fill="currentColor" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <DropdownMenuItem
                  key={p}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (p !== deal.priority) onChangePriority?.(deal, p);
                  }}
                  className={cn(deal.priority === p && 'bg-muted font-medium')}
                >
                  <Flag
                    className={cn('h-3.5 w-3.5 mr-2', priorityIconColor[p])}
                    fill="currentColor"
                  />
                  {PRIORITY_CONFIG[p].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tags */}
        {(deal.tags?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {deal.tags!.slice(0, 2).map((tag) => (
              <Badge 
                key={tag} 
                variant="secondary" 
                className="text-[10px] px-1.5 py-0"
              >
                {tag}
              </Badge>
            ))}
            {deal.tags!.length > 2 && (
              <Badge 
                variant="secondary" 
                className="text-[10px] px-1.5 py-0"
              >
                +{deal.tags!.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Link badges */}
        {(chatLink || juliaLink) && (
          <div className="flex items-center gap-1 flex-wrap pt-1">
            {chatLink && !isJuliaCard && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-700 border-blue-500/30 gap-1"
              >
                <MessageSquare className="h-2.5 w-2.5" /> Chat
              </Badge>
            )}
            {chatLink && isJuliaCard && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-700 border-purple-500/30 gap-1"
              >
                <Scale className="h-2.5 w-2.5" /> Jul.IA
              </Badge>
            )}
            {chatLink && queueName && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 gap-1 bg-amber-500/10 text-amber-700 border-amber-500/30 max-w-[140px]"
                title={`Fila: ${queueName}`}
              >
                <Inbox className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">{queueName}</span>
              </Badge>
            )}
            {juliaLink && (
              <>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-700 border-purple-500/30 gap-1"
                >
                  <Scale className="h-2.5 w-2.5" /> Julia #{juliaLink.card_id}
                </Badge>
                {(liveJulia?.stage_name || juliaLink.stage_name) && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 gap-1"
                    style={{
                      backgroundColor: `${liveJulia?.stage_color || '#a855f7'}15`,
                      color: liveJulia?.stage_color || '#7c3aed',
                      borderColor: `${liveJulia?.stage_color || '#a855f7'}40`,
                    }}
                  >
                    {liveJulia?.stage_name || juliaLink.stage_name}
                  </Badge>
                )}
                {liveJulia?.business_name && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-muted/40 text-muted-foreground"
                  >
                    {liveJulia.business_name}
                  </Badge>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer: datas + tempo na fase */}
        <div className="pt-1 border-t border-border/50 space-y-0.5 text-[10px] text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Criado:</span>
            <span className="truncate text-right">
              {deal.created_by ? `${deal.created_by} · ` : ''}{formatDate(deal.created_at)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Atualizado:</span>
            <span className="truncate text-right">
              {(deal.updated_by || deal.created_by) ? `${deal.updated_by || deal.created_by} · ` : ''}{formatDate(deal.updated_at)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Na fase: {timeInStage}</span>
            </div>
            <span className="text-[9px]">🇧🇷 Brasília</span>
          </div>
        </div>
      </CardContent>
      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isLinked ? 'Excluir card?' : 'Arquivar card?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isLinked
                ? `Isso removerá o card "${deal.title}" do CRM. A conversa vinculada não será afetada. Esta ação não pode ser desfeita.`
                : `O card "${deal.title}" será arquivado e não aparecerá mais no funil. Você poderá restaurá-lo depois.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.stopPropagation(); onArchive(); setConfirmArchive(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLinked ? 'Excluir' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {deal.contact_phone && (
        <PhoneCallDialog
          open={phoneCallOpen}
          onOpenChange={setPhoneCallOpen}
          whatsappNumber={deal.contact_phone}
          contactName={deal.contact_name || deal.title}
          codAgent={deal.cod_agent || ''}
        />
      )}

      {showAmberWhatsapp && (
        <NewConversationDialog
          open={newConvOpen}
          onOpenChange={setNewConvOpen}
          queues={waQueues}
          initialPhone={(deal.contact_phone || '').replace(/\D/g, '')}
          initialName={deal.contact_name || ''}
          lockContact
          clientId={user?.client_id ? String(user.client_id) : undefined}
          currentUser={user?.cod_agent ? { codAgent: String(user.cod_agent), name: user?.name || '' } : undefined}
        />
      )}
    </Card>
  );
}
