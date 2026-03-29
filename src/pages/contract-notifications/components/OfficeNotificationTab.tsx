import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Save, Info, X } from 'lucide-react';
import { ContractNotificationConfig, useUpsertContractNotificationConfig } from '@/hooks/useContractNotificationConfig';
import { ContractCadenceStepEditor } from './ContractCadenceStepEditor';
import { CadenceStep } from '@/pages/agente/types';

interface Props {
  codAgent: string;
  config?: ContractNotificationConfig;
}

const DEFAULT_STEPS: CadenceStep[] = [
  { key: 'cadence_1', interval: '5 minutes', title: 'Alerta imediato', message: '📋 *Novo contrato {trigger_label}*\n\n👤 Lead: {client_name}\n📱 Telefone: {client_phone}\n📌 Caso: {case_title}\n\n📝 Resumo:\n{case_summary}' },
];

function stepsFromConfig(config: ContractNotificationConfig): CadenceStep[] {
  const stepCadence = config.step_cadence || {};
  const msgCadence = config.msg_cadence || {};
  const titleCadence = config.title_cadence || {};
  const keys = Object.keys(stepCadence).sort((a, b) => {
    const na = parseInt(a.replace('cadence_', ''));
    const nb = parseInt(b.replace('cadence_', ''));
    return na - nb;
  });
  if (keys.length === 0) return DEFAULT_STEPS;
  return keys.map((key) => ({
    key,
    interval: stepCadence[key] || '5 minutes',
    title: titleCadence[key] || key,
    message: msgCadence[key] || null,
  }));
}

export function OfficeNotificationTab({ codAgent, config }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [triggerEvent, setTriggerEvent] = useState('BOTH');
  const [targetNumbers, setTargetNumbers] = useState<string[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [steps, setSteps] = useState<CadenceStep[]>(DEFAULT_STEPS);

  const upsert = useUpsertContractNotificationConfig();

  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setTriggerEvent(config.trigger_event || 'BOTH');
      setTargetNumbers(config.target_numbers || []);
      setSteps(stepsFromConfig(config));
    }
  }, [config]);

  const handleAddNumber = () => {
    const cleaned = newNumber.replace(/\D/g, '');
    if (cleaned.length >= 10 && !targetNumbers.includes(cleaned)) {
      setTargetNumbers([...targetNumbers, cleaned]);
      setNewNumber('');
    }
  };

  const handleRemoveNumber = (num: string) => {
    setTargetNumbers(targetNumbers.filter((n) => n !== num));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNumber();
    }
  };

  const handleSave = () => {
    const step_cadence: Record<string, string> = {};
    const msg_cadence: Record<string, string | null> = {};
    const title_cadence: Record<string, string> = {};
    steps.forEach((s, i) => {
      const key = `cadence_${i + 1}`;
      step_cadence[key] = s.interval;
      msg_cadence[key] = s.message;
      title_cadence[key] = s.title;
    });

    upsert.mutate({
      cod_agent: codAgent,
      type: 'OFFICE_ALERT',
      is_active: isActive,
      trigger_event: triggerEvent,
      target_numbers: targetNumbers,
      stages_count: steps.length,
      step_cadence,
      msg_cadence,
      title_cadence,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Notificar Escritório</CardTitle>
              <CardDescription>
                Alertas para números do escritório quando contratos são gerados ou assinados
              </CardDescription>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Disparar Quando</Label>
            <RadioGroup value={triggerEvent} onValueChange={setTriggerEvent}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="GENERATED" id="generated" />
                <Label htmlFor="generated" className="font-normal">Ao Gerar Contrato</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="SIGNED" id="signed" />
                <Label htmlFor="signed" className="font-normal">Ao Assinar Contrato</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="BOTH" id="both" />
                <Label htmlFor="both" className="font-normal">Ambos</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Números WhatsApp do Escritório</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: 11999998888"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button variant="outline" onClick={handleAddNumber} type="button">
                Adicionar
              </Button>
            </div>
            {targetNumbers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {targetNumbers.map((num) => (
                  <span
                    key={num}
                    className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                  >
                    {num}
                    <button onClick={() => handleRemoveNumber(num)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>Etapas de Alerta</Label>
            <ContractCadenceStepEditor
              steps={steps}
              onChange={setSteps}
              variables={['client_name', 'client_phone', 'case_title', 'case_summary', 'trigger_label']}
            />
          </div>

          <div className="bg-muted/50 border rounded-lg p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Dados Automáticos</p>
              <p className="text-xs text-muted-foreground">
                Nome do Lead, telefone e Resumo do Caso serão injetados automaticamente na mensagem.
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={upsert.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configuração
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
