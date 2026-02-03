import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Zap, Loader2 } from 'lucide-react';
import { AutomationRuleCard } from './AutomationRuleCard';
import { CreateAutomationDialog } from './CreateAutomationDialog';
import { useCRMAutomations, type CRMAutomationRule, type CRMAutomationRuleFormData } from '../../hooks/useCRMAutomations';
import type { CRMPipeline } from '../../types';

interface AutomationsManagerProps {
  boardId: string;
  codAgent: string;
  pipelines: CRMPipeline[];
}

export function AutomationsManager({
  boardId,
  codAgent,
  pipelines,
}: AutomationsManagerProps) {
  const { rules, isLoading, createRule, updateRule, deleteRule, toggleRuleActive } = useCRMAutomations({
    boardId,
    codAgent,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CRMAutomationRule | null>(null);

  const handleCreate = async (data: CRMAutomationRuleFormData) => {
    if (editingRule) {
      const success = await updateRule(editingRule.id, data);
      if (success) {
        setEditingRule(null);
        setDialogOpen(false);
      }
      return success ? editingRule : null;
    }
    return createRule(data);
  };

  const handleEdit = (rule: CRMAutomationRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingRule(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Automações</h3>
          <p className="text-xs text-muted-foreground">
            Configure regras para mover cards automaticamente
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-8 text-center">
          <Zap className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <h4 className="font-medium mb-1">Nenhuma automação</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Crie automações para mover cards automaticamente entre etapas
          </p>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Criar primeira automação
          </Button>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {rules.map((rule) => (
              <AutomationRuleCard
                key={rule.id}
                rule={rule}
                pipelines={pipelines}
                onEdit={() => handleEdit(rule)}
                onDelete={() => deleteRule(rule.id)}
                onToggleActive={() => toggleRuleActive(rule.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <CreateAutomationDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        onSubmit={handleCreate}
        pipelines={pipelines}
        editRule={editingRule}
      />
    </div>
  );
}
