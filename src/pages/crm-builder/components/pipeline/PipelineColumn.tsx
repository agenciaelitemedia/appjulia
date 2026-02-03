import React, { useState, useMemo, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
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
import type { CRMPipeline, CRMDeal } from '../../types';

const ITEMS_PER_PAGE = 30;

interface PipelineColumnProps {
  pipeline: CRMPipeline;
  deals: CRMDeal[];
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onAddDeal: () => void;
}

export function PipelineColumn({
  pipeline,
  deals,
  children,
  onEdit,
  onDelete,
  onAddDeal,
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
    data: {
      type: 'pipeline',
      pipeline,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
      style={style}
      className={cn(
        'flex-shrink-0 min-w-[280px] max-w-[280px] flex flex-col bg-muted/30 rounded-lg',
        isDragging && 'opacity-50'
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Header */}
      <div 
        className="p-3 rounded-t-lg flex items-center justify-between gap-2"
        style={{ backgroundColor: `${pipeline.color}20` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className={cn(
              'cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted transition-opacity',
              isHovering ? 'opacity-100' : 'opacity-0'
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0" 
            style={{ backgroundColor: pipeline.color }}
          />
          
          <h3 className="font-medium text-sm truncate">
            {pipeline.name}
          </h3>
          
          <Badge variant="secondary" className="text-xs">
            {stats.count}
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar Etapa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Remover Etapa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats bar */}
      {stats.value > 0 && (
        <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-muted/20">
          Total: {formatCurrency(stats.value)}
        </div>
      )}

      {/* Deals container */}
      <div className="flex-1 p-2">
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
        
        {/* Add deal button integrated */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground mt-2"
          onClick={onAddDeal}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Card
        </Button>
      </div>
    </div>
  );
}
