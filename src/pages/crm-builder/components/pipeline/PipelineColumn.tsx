import React, { useState, useMemo, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Plus, 
  Pencil, 
  Trash2,
  GripVertical,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hslFromHex } from '@/lib/colorToHsl';
import type { CRMPipeline, CRMDeal } from '../../types';

const ITEMS_PER_PAGE = 30;

interface PipelineColumnProps {
  pipeline: CRMPipeline;
  deals: CRMDeal[];
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onAddDeal: () => void;
  canCreateDeal?: boolean;
}

export function PipelineColumn({
  pipeline,
  deals,
  children,
  onEdit,
  onDelete,
  onAddDeal,
  canCreateDeal = true,
}: PipelineColumnProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Reset pagination when deals change
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [deals.length]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `pipeline-${pipeline.id}`,
    disabled: !!pipeline.is_system,
    data: {
      type: 'pipeline',
      pipeline,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Droppable area for cards (independent from sortable used to reorder columns)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `pipeline-drop-${pipeline.id}`,
    data: {
      type: 'pipeline-area',
      pipelineId: pipeline.id,
    },
  });

  // Calculate stats
  const stats = useMemo(() => {
    const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    return {
      count: deals.length,
      value: totalValue,
    };
  }, [deals]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const hasMore = deals.length > visibleCount;
  const remaining = Math.min(ITEMS_PER_PAGE, deals.length - visibleCount);

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, deals.length));
  };

  // Get only the visible children
  const childrenArray = React.Children.toArray(children);
  const visibleChildren = childrenArray.slice(0, visibleCount);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ['--stage-color' as string]: hslFromHex(pipeline.color) }}
      className={cn(
        'aj-column-shell flex-shrink-0 min-w-[280px] max-w-[280px] flex flex-col rounded-xl overflow-hidden',
        isDragging && 'opacity-50'
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      aria-label={`Etapa ${pipeline.name}`}
    >
      {/* Header */}
      <div className="aj-column-head p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            {...attributes}
            {...listeners}
            aria-label={`Reordenar etapa ${pipeline.name}`}
            className={cn(
              'aj-focus-ring cursor-grab active:cursor-grabbing p-1 rounded transition-opacity hover:bg-foreground/10 focus-visible:opacity-100',
              isHovering && !pipeline.is_system ? 'opacity-100' : 'opacity-0',
              pipeline.is_system && 'pointer-events-none'
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-inset ring-foreground/10" 
            style={{ backgroundColor: pipeline.color }}
          />
          
          <h3 className="aj-title-gradient font-semibold text-sm truncate">
            {pipeline.name}
          </h3>

          {pipeline.is_system && (
            <Badge variant="outline" className="text-[10px] flex-shrink-0">Julia</Badge>
          )}
          
          <Badge variant="secondary" className="text-xs">
            {stats.count}
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Ações da etapa ${pipeline.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canCreateDeal && (
              <>
                <DropdownMenuItem onClick={onAddDeal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Card
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {!pipeline.is_system && (
              <>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar Etapa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover Etapa
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats bar */}
      {stats.value > 0 && (
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/70 bg-background/40 backdrop-blur-sm">
          Total: {formatCurrency(stats.value)}
        </div>
      )}

      {/* Deals container */}
      <div
        ref={setDropRef}
        className={cn(
          'flex-1 flex flex-col p-2 transition-all min-h-[300px] rounded-b-xl',
          isOver && 'aj-drop-active'
        )}
      >
        <div className="space-y-2">
          {deals.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum card neste estágio
            </div>
          ) : (
            <>
              {visibleChildren}
              
              {hasMore && (
                <div className="pt-2 border-t border-border/50 text-center space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    className="w-full gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Ver mais ({remaining})
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Exibindo {visibleCount} de {deals.length}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        {/* Spacer interno garante que a área inteira (até o rodapé) absorva drops */}
        <div className="flex-1 min-h-[60px]" />
      </div>

      {/* Rodapé fora do droppable: o botão "Adicionar Card" não intercepta drops */}
      {canCreateDeal && (
        <div className="p-2 pt-0 rounded-b-lg">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={onAddDeal}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Card
          </Button>
        </div>
      )}
    </div>
  );
}
