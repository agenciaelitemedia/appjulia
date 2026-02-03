import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  MoreHorizontal, 
  Pencil, 
  Archive,
  Trophy,
  XCircle,
  User,
  Phone,
  DollarSign,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CRMDeal } from '../../types';
import { PRIORITY_CONFIG } from '../../types';

interface DealCardProps {
  deal: CRMDeal;
  pipelineColor?: string;
  onEdit: () => void;
  onArchive: () => void;
  onWon: () => void;
  onLost: () => void;
  onClick?: () => void;
}

export function DealCard({
  deal,
  pipelineColor,
  onEdit,
  onArchive,
  onWon,
  onLost,
  onClick,
}: DealCardProps) {
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
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
                onClick={(e) => { e.stopPropagation(); onArchive(); }}
                className="text-destructive"
              >
                <Archive className="h-4 w-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

        {/* Dates section */}
        <div className="space-y-0.5 pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="font-medium">Criado:</span>
            <span>{formatDate(deal.created_at)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Atualizado:</span>
            <span>{formatDate(deal.updated_at)}</span>
          </div>
        </div>

        {/* Footer with priority, time and timezone */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge 
              variant="outline" 
              className={cn('text-[10px] px-1.5 py-0', priorityConfig.color, priorityConfig.bgColor)}
            >
              {priorityConfig.label}
            </Badge>
            
            {deal.tags?.slice(0, 2).map((tag) => (
              <Badge 
                key={tag} 
                variant="secondary" 
                className="text-[10px] px-1.5 py-0"
              >
                {tag}
              </Badge>
            ))}
            
            {deal.tags?.length > 2 && (
              <Badge 
                variant="secondary" 
                className="text-[10px] px-1.5 py-0"
              >
                +{deal.tags.length - 2}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Na fase: {timeInStage}</span>
          </div>
          <span className="text-[9px]">🇧🇷 Brasília</span>
        </div>
      </CardContent>
    </Card>
  );
}
