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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CRMDeal } from '../../types';
import { PRIORITY_CONFIG } from '../../types';
import { getChatLink, getJuliaLink, useJuliaCardPreview } from '../../hooks/useCardLinks';
import { useDealConversation } from '../../hooks/useDealConversation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTeamMembers } from '@/pages/equipe/hooks/useEquipeData';

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
  onChangeAssignee?: (deal: CRMDeal, assignedTo: string | null) => void;
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
  onChangeAssignee,
}: DealCardProps) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const { data: teamMembers = [] } = useTeamMembers();
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
        isDragging && 'opacity-50 shadow-lg rotate-2',
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title={`Responsável: ${deal.assigned_to || 'Não atribuído'} — clique para alterar`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] px-1.5 py-0 border rounded-md max-w-[160px] hover:opacity-80 transition-opacity',
                  deal.assigned_to
                    ? 'bg-primary/5 border-primary/30 text-primary'
                    : 'bg-muted text-muted-foreground border-border'
                )}
              >
                <User className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">{deal.assigned_to || 'Não atribuído'}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[280px] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  if (deal.assigned_to) onChangeAssignee?.(deal, null);
                }}
                className={cn(!deal.assigned_to && 'bg-muted font-medium')}
              >
                <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                Não atribuído
              </DropdownMenuItem>
              {teamMembers.length > 0 && <DropdownMenuSeparator />}
              {teamMembers.map((m) => {
                const label = m.name || m.email;
                const isActive = deal.assigned_to === label;
                return (
                  <DropdownMenuItem
                    key={String(m.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isActive) onChangeAssignee?.(deal, label);
                    }}
                    className={cn(isActive && 'bg-muted font-medium')}
                  >
                    <User className="h-3.5 w-3.5 mr-2 text-primary" />
                    {label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

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
            {chatLink && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-700 border-blue-500/30 gap-1"
              >
                <MessageSquare className="h-2.5 w-2.5" /> Chat
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
            <span>{formatDate(deal.created_at)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Atualizado:</span>
            <span>{formatDate(deal.updated_at)}</span>
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
    </Card>
  );
}
