import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Trash2,
  Zap,
  ArrowRight,
  Clock,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CRMAutomationRule } from '../../hooks/useCRMAutomations';
import { TRIGGER_TYPES, ACTION_TYPES, TRIGGER_OPERATORS } from '../../hooks/useCRMAutomations';
import type { CRMPipeline } from '../../types';

interface AutomationRuleCardProps {
  rule: CRMAutomationRule;
  pipelines: CRMPipeline[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

export function AutomationRuleCard({
  rule,
  pipelines,
  onEdit,
  onDelete,
  onToggleActive,
}: AutomationRuleCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const fromPipeline = pipelines.find(p => p.id === rule.from_pipeline_id);
  const toPipeline = pipelines.find(p => p.id === rule.to_pipeline_id);

  const getTriggerDescription = () => {
    switch (rule.trigger_type) {
      case 'on_create':
        return 'Quando um card for criado';
      case 'time_based':
        return 'Baseado em tempo';
      case 'field_change':
        if (rule.trigger_field && rule.trigger_operator) {
          const operatorLabel = TRIGGER_OPERATORS[rule.trigger_operator] || rule.trigger_operator;
          return `Quando "${rule.trigger_field}" ${operatorLabel.toLowerCase()} "${rule.trigger_value || ''}"`;
        }
        return 'Quando um campo mudar';
      default:
        return TRIGGER_TYPES[rule.trigger_type] || rule.trigger_type;
    }
  };

  const getActionDescription = () => {
    switch (rule.action_type) {
      case 'move_to_pipeline':
        if (toPipeline) {
          return `Mover para "${toPipeline.name}"`;
        }
        return 'Mover para etapa';
      case 'update_field':
        return 'Atualizar campo';
      case 'set_status':
        return 'Definir status';
      default:
        return ACTION_TYPES[rule.action_type] || rule.action_type;
    }
  };

  return (
    <>
      <Card className={cn(
        'transition-all',
        !rule.is_active && 'opacity-60'
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  rule.is_active ? 'bg-primary/10' : 'bg-muted'
                )}>
                  <Zap className={cn(
                    'h-4 w-4',
                    rule.is_active ? 'text-primary' : 'text-muted-foreground'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{rule.name}</h4>
                  {rule.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {rule.description}
                    </p>
                  )}
                </div>
                <Switch
                  checked={rule.is_active}
                  onCheckedChange={onToggleActive}
                />
              </div>

              {/* Rule details */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {/* From pipeline */}
                {fromPipeline && (
                  <Badge variant="outline" className="gap-1">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: fromPipeline.color }}
                    />
                    {fromPipeline.name}
                  </Badge>
                )}

                {/* Trigger */}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{getTriggerDescription()}</span>
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground" />

                {/* Action */}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Play className="h-3 w-3" />
                  <span>{getActionDescription()}</span>
                </div>

                {/* To pipeline */}
                {toPipeline && rule.action_type === 'move_to_pipeline' && (
                  <Badge variant="secondary" className="gap-1">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: toPipeline.color }}
                    />
                    {toPipeline.name}
                  </Badge>
                )}
              </div>

              {/* Stats */}
              {rule.execution_count > 0 && (
                <p className="text-xs text-muted-foreground">
                  Executada {rule.execution_count} {rule.execution_count === 1 ? 'vez' : 'vezes'}
                  {rule.last_executed_at && (
                    <> · Última: {new Date(rule.last_executed_at).toLocaleDateString('pt-BR')}</>
                  )}
                </p>
              )}
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)} 
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a automação "{rule.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
