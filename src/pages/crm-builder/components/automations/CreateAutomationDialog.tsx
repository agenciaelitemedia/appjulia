import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Zap } from 'lucide-react';
import type { CRMPipeline } from '../../types';
import type { 
  CRMAutomationRule, 
  CRMAutomationRuleFormData,
  TriggerType,
  TriggerOperator,
  ActionType,
} from '../../hooks/useCRMAutomations';
import { 
  TRIGGER_TYPES, 
  TRIGGER_OPERATORS, 
  ACTION_TYPES,
  TRIGGER_FIELDS,
} from '../../hooks/useCRMAutomations';

interface CreateAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CRMAutomationRuleFormData) => Promise<CRMAutomationRule | null>;
  pipelines: CRMPipeline[];
  editRule?: CRMAutomationRule | null;
}

export function CreateAutomationDialog({
  open,
  onOpenChange,
  onSubmit,
  pipelines,
  editRule,
}: CreateAutomationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('field_change');
  const [triggerField, setTriggerField] = useState('');
  const [triggerOperator, setTriggerOperator] = useState<TriggerOperator>('equals');
  const [triggerValue, setTriggerValue] = useState('');
  const [fromPipelineId, setFromPipelineId] = useState('');
  const [toPipelineId, setToPipelineId] = useState('');
  const [actionType, setActionType] = useState<ActionType>('move_to_pipeline');

  // Reset form when editRule changes
  useEffect(() => {
    if (editRule) {
      setName(editRule.name);
      setDescription(editRule.description || '');
      setTriggerType(editRule.trigger_type);
      setTriggerField(editRule.trigger_field || '');
      setTriggerOperator(editRule.trigger_operator || 'equals');
      setTriggerValue(editRule.trigger_value || '');
      setFromPipelineId(editRule.from_pipeline_id || '');
      setToPipelineId(editRule.to_pipeline_id || '');
      setActionType(editRule.action_type);
    } else {
      setName('');
      setDescription('');
      setTriggerType('field_change');
      setTriggerField('');
      setTriggerOperator('equals');
      setTriggerValue('');
      setFromPipelineId('');
      setToPipelineId('');
      setActionType('move_to_pipeline');
    }
  }, [editRule, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const formData: CRMAutomationRuleFormData = {
        name: name.trim(),
        description: description.trim() || undefined,
        trigger_type: triggerType,
        trigger_field: triggerField || undefined,
        trigger_operator: triggerOperator,
        trigger_value: triggerValue || undefined,
        from_pipeline_id: fromPipelineId || undefined,
        to_pipeline_id: toPipelineId || undefined,
        action_type: actionType,
      };

      const result = await onSubmit(formData);

      if (result) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const showTriggerFields = triggerType === 'field_change';
  const showToPipeline = actionType === 'move_to_pipeline';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {editRule ? 'Editar Automação' : 'Nova Automação'}
            </DialogTitle>
            <DialogDescription>
              Configure regras para mover cards automaticamente entre etapas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Nome e descrição */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome da automação *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Mover para aprovação quando prioridade alta"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o que essa automação faz..."
                rows={2}
              />
            </div>

            <Separator />

            {/* Trigger Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Quando executar</h4>

              <div className="space-y-2">
                <Label htmlFor="triggerType">Tipo de gatilho</Label>
                <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showTriggerFields && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="triggerField">Campo</Label>
                    <Select value={triggerField} onValueChange={setTriggerField}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGER_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="triggerOperator">Condição</Label>
                    <Select value={triggerOperator} onValueChange={(v) => setTriggerOperator(v as TriggerOperator)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRIGGER_OPERATORS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {showTriggerFields && triggerOperator !== 'is_empty' && triggerOperator !== 'is_not_empty' && (
                <div className="space-y-2">
                  <Label htmlFor="triggerValue">Valor</Label>
                  <Input
                    id="triggerValue"
                    value={triggerValue}
                    onChange={(e) => setTriggerValue(e.target.value)}
                    placeholder="Ex: high, urgent, 1000"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fromPipeline">Etapa de origem (opcional)</Label>
                <Select value={fromPipelineId} onValueChange={setFromPipelineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Qualquer etapa</SelectItem>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: pipeline.color }}
                          />
                          {pipeline.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Action Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Então fazer</h4>
              </div>

              <div className="space-y-2">
                <Label htmlFor="actionType">Ação</Label>
                <Select value={actionType} onValueChange={(v) => setActionType(v as ActionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showToPipeline && (
                <div className="space-y-2">
                  <Label htmlFor="toPipeline">Mover para etapa *</Label>
                  <Select value={toPipelineId} onValueChange={setToPipelineId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a etapa de destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((pipeline) => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: pipeline.color }}
                            />
                            {pipeline.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !name.trim() || (showToPipeline && !toPipelineId)}
            >
              {isSubmitting ? 'Salvando...' : editRule ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
