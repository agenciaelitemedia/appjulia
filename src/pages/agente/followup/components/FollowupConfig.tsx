import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Save, Sparkles } from 'lucide-react';
import { FollowupConfig as FollowupConfigType, CadenceStep, HOUR_OPTIONS } from '../../types';
import { CadenceStepEditor } from './CadenceStepEditor';

interface FollowupConfigProps {
  config: FollowupConfigType | null;
  isLoading?: boolean;
  isSaving?: boolean;
  onSave: (config: Partial<FollowupConfigType>) => void;
}

// Parse JSONB fields from database (they may be strings or objects)
function parseJsonField<T>(value: T | string | null | undefined, defaultValue: T): T {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }
  return value as T;
}

export function FollowupConfig({ config, isLoading, isSaving, onSave }: FollowupConfigProps) {
  const [autoMessage, setAutoMessage] = useState(true);
  const [startHours, setStartHours] = useState(9);
  const [endHours, setEndHours] = useState(19);
  const [steps, setSteps] = useState<CadenceStep[]>([]);

  // Initialize state from config
  useEffect(() => {
    if (config) {
      setAutoMessage(config.auto_message ?? true);
      setStartHours(config.start_hours ?? 9);
      setEndHours(config.end_hours ?? 19);

      // Parse JSONB cadence fields
      const stepCadence = parseJsonField<Record<string, string>>(config.step_cadence, {});
      const msgCadence = parseJsonField<Record<string, string | null>>(config.msg_cadence, {});
      const titleCadence = parseJsonField<Record<string, string>>(config.title_cadence, {});

      // Convert JSONB to steps array
      const parsedSteps: CadenceStep[] = [];
      const keys = Object.keys(stepCadence).sort((a, b) => {
        const numA = parseInt(a.replace('cadence_', ''), 10);
        const numB = parseInt(b.replace('cadence_', ''), 10);
        return numA - numB;
      });

      keys.forEach((key) => {
        parsedSteps.push({
          key,
          interval: stepCadence[key] || '5 minutes',
          title: titleCadence[key] || '',
          message: msgCadence[key] || null,
        });
      });

      // If no steps, create default
      if (parsedSteps.length === 0) {
        parsedSteps.push({
          key: 'cadence_1',
          interval: '5 minutes',
          title: 'Primeiro contato',
          message: null,
        });
      }

      setSteps(parsedSteps);
    }
  }, [config]);

  const handleAddStep = () => {
    const nextNumber = steps.length + 1;
    setSteps([
      ...steps,
      {
        key: `cadence_${nextNumber}`,
        interval: '1 days',
        title: `Etapa ${nextNumber}`,
        message: null,
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    // Renumber keys
    const renumberedSteps = newSteps.map((step, i) => ({
      ...step,
      key: `cadence_${i + 1}`,
    }));
    setSteps(renumberedSteps);
  };

  const handleStepChange = (index: number, updatedStep: CadenceStep) => {
    const newSteps = [...steps];
    newSteps[index] = updatedStep;
    setSteps(newSteps);
  };

  const handleSave = () => {
    // Convert steps array back to JSONB format
    const stepCadence: Record<string, string> = {};
    const msgCadence: Record<string, string | null> = {};
    const titleCadence: Record<string, string> = {};

    steps.forEach((step) => {
      stepCadence[step.key] = step.interval;
      msgCadence[step.key] = step.message;
      titleCadence[step.key] = step.title;
    });

    onSave({
      step_cadence: stepCadence,
      msg_cadence: msgCadence,
      title_cadence: titleCadence,
      start_hours: startHours,
      end_hours: endHours,
      auto_message: autoMessage,
      followup_from: 1,
      followup_to: steps.length,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Configurações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Message Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-message" className="text-base">
                Mensagem Automática
              </Label>
              <p className="text-sm text-muted-foreground">
                Gerar mensagens automaticamente usando a IA Julia
              </p>
            </div>
            <Switch
              id="auto-message"
              checked={autoMessage}
              onCheckedChange={setAutoMessage}
            />
          </div>

          {/* Working Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-hours">Horário de Início</Label>
              <Select
                value={startHours.toString()}
                onValueChange={(v) => setStartHours(parseInt(v, 10))}
              >
                <SelectTrigger id="start-hours">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map((hour) => (
                    <SelectItem key={hour.value} value={hour.value.toString()}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-hours">Horário de Fim</Label>
              <Select
                value={endHours.toString()}
                onValueChange={(v) => setEndHours(parseInt(v, 10))}
              >
                <SelectTrigger id="end-hours">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map((hour) => (
                    <SelectItem key={hour.value} value={hour.value.toString()}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cadence Steps */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Etapas do FollowUp</h3>
          <Button variant="outline" size="sm" onClick={handleAddStep}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Etapa
          </Button>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <CadenceStepEditor
              key={step.key}
              step={step}
              stepNumber={index + 1}
              autoMessage={autoMessage}
              onChange={(updatedStep) => handleStepChange(index, updatedStep)}
              onRemove={() => handleRemoveStep(index)}
              canRemove={steps.length > 1}
            />
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
