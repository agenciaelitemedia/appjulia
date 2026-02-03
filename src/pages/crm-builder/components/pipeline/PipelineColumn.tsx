import { useState, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CRMPipeline, CRMDeal } from '../../types';

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex-shrink-0 w-80 flex flex-col bg-muted/30 rounded-xl border',
        isDragging && 'opacity-50'
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Header */}
      <div 
        className="p-3 border-b flex items-center justify-between gap-2"
        style={{ borderBottomColor: `${pipeline.color}40` }}
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
      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] max-h-[calc(100vh-300px)]">
        {children}
      </div>

      {/* Add deal button */}
      <div className="p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={onAddDeal}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Card
        </Button>
      </div>
    </div>
  );
}
