import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Info, X } from 'lucide-react';
import { ContractNotificationConfig, useUpsertContractNotificationConfig } from '@/hooks/useContractNotificationConfig';
import { ContractCadenceStepEditor } from './ContractCadenceStepEditor';
import { CadenceStep } from '@/pages/agente/types';

interface Props {
  codAgent: string;
  config?: ContractNotificationConfig;
}

interface NumberConfig {
  phone: string;
  trigger: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  GENERATED: 'Ao Gerar',
  SIGNED: 'Ao Assinar',
  BOTH: 'Ambos',
};

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
  const [numbersConfig, setNumbersConfig] = useState<NumberConfig[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [newTrigger, setNewTrigger] = useState('BOTH');
  const [steps, setSteps] = useState<CadenceStep[]>(DEFAULT_STEPS);
  const [triggerCadence, setTriggerCadence] = useState<Record<string, string>>({ cadence_1: 'BOTH' });

  const upsert = useUpsertContractNotificationConfig();

  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setSteps(stepsFromConfig(config));
      setTriggerCadence(config.trigger_cadence || {});

      // Load from target_numbers_config (new) or fallback to target_numbers (old)
      const tnc = config.target_numbers_config;
      if (tnc && Array.isArray(tnc) && tnc.length > 0) {
        setNumbersConfig(tnc);
      } else if (config.target_numbers && config.target_numbers.length > 0) {
        setNumbersConfig(config.target_numbers.map(phone => ({
          phone,
          trigger: config.trigger_event || 'BOTH',
        })));
      }
    }
  }, [config]);

  const handleAddNumber = () => {
    const cleaned = newNumber.replace(/\D/g, '');
    if (cleaned.length >= 10 && !numbersConfig.some(n => n.phone === cleaned)) {
      setNumbersConfig([...numbersConfig, { phone: cleaned, trigger: newTrigger }]);
      setNewNumber('');
      setNewTrigger('BOTH');
    }
  };

  const handleRemoveNumber = (phone: string) => {
    setNumbersConfig(numbersConfig.filter((n) => n.phone !== phone));
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
      target_numbers: numbersConfig.map(n => n.phone),
      target_numbers_config: numbersConfig,
      stages_count: steps.length,
      step_cadence,
      msg_cadence,
      title_cadence,
      trigger_cadence: triggerCadence,
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
          <div className="space-y-2">
            <Label>Números WhatsApp do Escritório</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: 11999998888"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Select value={newTrigger} onValueChange={setNewTrigger}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERATED">Ao Gerar</SelectItem>
                  <SelectItem value="SIGNED">Ao Assinar</SelectItem>
                  <SelectItem value="BOTH">Ambos</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleAddNumber} type="button">
                Adicionar
              </Button>
            </div>
            {numbersConfig.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {numbersConfig.map((item) => (
                  <span
                    key={item.phone}
                    className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                  >
                    {item.phone}
                    <span className="text-xs opacity-70">· {TRIGGER_LABELS[item.trigger] || item.trigger}</span>
                    <button onClick={() => handleRemoveNumber(item.phone)} className="hover:text-destructive">
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
              showTriggerSelect
              stepTriggers={triggerCadence}
              onTriggersChange={setTriggerCadence}
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
