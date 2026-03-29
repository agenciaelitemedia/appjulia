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
}

export function ContractCadenceStepEditor({ steps, onChange, variables = [], maxSteps = 10 }: Props) {
  const handleAddStep = () => {
    if (steps.length >= maxSteps) return;
    const idx = steps.length + 1;
    onChange([
      ...steps,
      {
        key: `cadence_${idx}`,
        interval: '1440 minutes',
        title: `Etapa ${idx}`,
        message: '',
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index).map((s, i) => ({
      ...s,
      key: `cadence_${i + 1}`,
    }));
    onChange(updated);
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

              <div className="grid grid-cols-2 gap-2">
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
