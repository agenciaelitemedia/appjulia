import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { CadenceStep, INTERVAL_UNITS, parseInterval, formatInterval } from '@/pages/agente/types';

interface Props {
  steps: CadenceStep[];
  onChange: (steps: CadenceStep[]) => void;
  variables?: string[];
  maxSteps?: number;
  showTriggerSelect?: boolean;
  stepTriggers?: Record<string, string>;
  onTriggersChange?: (triggers: Record<string, string>) => void;
}

const TRIGGER_OPTIONS = [
  { value: 'BOTH', label: 'Ambos' },
  { value: 'GENERATED', label: 'Contrato Gerado' },
  { value: 'SIGNED', label: 'Contrato Assinado' },
];

export function ContractCadenceStepEditor({ steps, onChange, variables = [], maxSteps = 10, showTriggerSelect, stepTriggers = {}, onTriggersChange }: Props) {
  const handleAddStep = () => {
    if (steps.length >= maxSteps) return;
    const idx = steps.length + 1;
    const key = `cadence_${idx}`;
    onChange([
      ...steps,
      {
        key,
        interval: '1440 minutes',
        title: `Etapa ${idx}`,
        message: '',
      },
    ]);
    if (showTriggerSelect && onTriggersChange) {
      onTriggersChange({ ...stepTriggers, [key]: 'BOTH' });
    }
  };

  const handleRemoveStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index).map((s, i) => ({
      ...s,
      key: `cadence_${i + 1}`,
    }));
    onChange(updated);
    if (showTriggerSelect && onTriggersChange) {
      const newTriggers: Record<string, string> = {};
      updated.forEach((s, i) => {
        const oldKey = steps[i < index ? i : i + 1]?.key;
        newTriggers[s.key] = stepTriggers[oldKey || ''] || 'BOTH';
      });
      onTriggersChange(newTriggers);
    }
  };

  const handleChangeInterval = (index: number, value: number, unit: string) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], interval: formatInterval(value, unit) };
    onChange(updated);
  };

  const handleChangeTitle = (index: number, title: string) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], title };
    onChange(updated);
  };

  const handleChangeMessage = (index: number, message: string) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], message };
    onChange(updated);
  };

  const handleChangeTrigger = (key: string, trigger: string) => {
    if (onTriggersChange) {
      onTriggersChange({ ...stepTriggers, [key]: trigger });
    }
  };

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const { value: intervalValue, unit: intervalUnit } = parseInterval(step.interval);
        return (
          <Card key={step.key} className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Etapa {index + 1}</span>
                </div>
                {steps.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveStep(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Título da Etapa</Label>
                <Input
                  value={step.title}
                  onChange={(e) => handleChangeTitle(index, e.target.value)}
                  placeholder="Ex: Primeiro lembrete"
                  className="h-8 text-sm"
                />
              </div>

              <div className={`grid gap-2 ${showTriggerSelect ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className="space-y-1">
                  <Label className="text-xs">Intervalo</Label>
                  <Input
                    type="number"
                    min={1}
                    value={intervalValue}
                    onChange={(e) => handleChangeInterval(index, Number(e.target.value), intervalUnit)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unidade</Label>
                  <Select value={intervalUnit} onValueChange={(u) => handleChangeInterval(index, intervalValue, u)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVAL_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {showTriggerSelect && (
                  <div className="space-y-1">
                    <Label className="text-xs">Disparar Quando</Label>
                    <Select value={stepTriggers[step.key] || 'BOTH'} onValueChange={(v) => handleChangeTrigger(step.key, v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGER_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Mensagem</Label>
                <Textarea
                  value={step.message || ''}
                  onChange={(e) => handleChangeMessage(index, e.target.value)}
                  rows={3}
                  className="text-sm"
                  placeholder="Mensagem desta etapa..."
                />
                {variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {variables.map((v) => (
                      <span key={v} className="text-xs bg-muted px-1.5 py-0.5 rounded">{`{${v}}`}</span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {steps.length < maxSteps && (
        <Button variant="outline" size="sm" onClick={handleAddStep} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Etapa
        </Button>
      )}
    </div>
  );
}
