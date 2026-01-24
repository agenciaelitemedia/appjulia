import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Plus, Save, Sparkles, Infinity, Info } from 'lucide-react';
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
  const [isInfiniteEnabled, setIsInfiniteEnabled] = useState(false);
  const [followupFrom, setFollowupFrom] = useState<number | null>(null);
  const [followupTo, setFollowupTo] = useState<number | null>(null);

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

      // Initialize infinite loop settings
      const hasInfinite = config.followup_from !== null && config.followup_to !== null;
      setIsInfiniteEnabled(hasInfinite);
      setFollowupFrom(config.followup_from);
      setFollowupTo(config.followup_to);
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

  // Handle infinite toggle - reset values when disabled
  // DB schema: followup_from = trigger step (e.g., 5), followup_to = return step (e.g., 4)
  const handleInfiniteToggle = (enabled: boolean) => {
    setIsInfiniteEnabled(enabled);
    if (!enabled) {
      setFollowupFrom(null);
      setFollowupTo(null);
    } else if (steps.length >= 2) {
      // Default: when reaching last step (from=5), go back to second-to-last (to=4)
      setFollowupFrom(steps.length);
      setFollowupTo(steps.length - 1);
    }
  };

  // Validate followupTo when followupFrom changes
  // followup_from = trigger step, followup_to = return step (must be < from)
  const handleFollowupFromChange = (value: string) => {
    const fromValue = parseInt(value, 10);
    setFollowupFrom(fromValue);
    // Ensure to is less than from
    if (followupTo && followupTo >= fromValue) {
      setFollowupTo(fromValue - 1);
    }
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
      followup_from: isInfiniteEnabled ? followupFrom : null,
      followup_to: isInfiniteEnabled ? followupTo : null,
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

          <Separator className="my-4" />

          {/* Infinite Loop Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="infinite-loop" className="text-base flex items-center gap-2">
                  <Infinity className="h-4 w-4" />
                  FollowUp Infinito (Loop)
                  {/* Badge showing configured flow */}
                  {isInfiniteEnabled && followupFrom && followupTo && (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {followupFrom} → {followupTo}
                    </span>
                  )}
                </Label>
                <p className="text-sm text-muted-foreground">
                  Reengajar o lead continuamente até obter resposta
                </p>
              </div>
              <Switch
                id="infinite-loop"
                checked={isInfiniteEnabled}
                onCheckedChange={handleInfiniteToggle}
                disabled={steps.length < 2}
              />
            </div>

            {isInfiniteEnabled && steps.length >= 2 && (
              <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label htmlFor="followup-from">Quando chegar na etapa</Label>
                  <Select
                    value={followupFrom?.toString() || ''}
                    onValueChange={handleFollowupFromChange}
                  >
                    <SelectTrigger id="followup-from">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {steps.map((step, index) => {
                        const stepNumber = index + 1;
                        // Only show steps from 2 onwards (can't loop back from step 1)
                        if (stepNumber < 2) return null;
                        return (
                          <SelectItem key={step.key} value={stepNumber.toString()}>
                            Etapa {stepNumber} - {step.title}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="followup-to">Voltar para a etapa</Label>
                  <Select
                    value={followupTo?.toString() || ''}
                    onValueChange={(v) => setFollowupTo(parseInt(v, 10))}
                  >
                    <SelectTrigger id="followup-to">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {steps.map((step, index) => {
                        const stepNumber = index + 1;
                        // Only show steps before the "from" step
                        if (followupFrom && stepNumber >= followupFrom) return null;
                        return (
                          <SelectItem key={step.key} value={stepNumber.toString()}>
                            Etapa {stepNumber} - {step.title}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>O lead será reengajado continuamente entre as etapas selecionadas até responder.</span>
                </div>
              </div>
            )}

            {steps.length < 2 && (
              <p className="text-sm text-muted-foreground italic">
                Adicione pelo menos 2 etapas para ativar o loop infinito.
              </p>
            )}
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
