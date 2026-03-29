import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Save, Link } from 'lucide-react';
import { ContractNotificationConfig, useUpsertContractNotificationConfig } from '@/hooks/useContractNotificationConfig';
import { ContractCadenceStepEditor } from './ContractCadenceStepEditor';
import { CadenceStep, parseInterval, formatInterval } from '@/pages/agente/types';

interface Props {
  codAgent: string;
  config?: ContractNotificationConfig;
}

const DEFAULT_STEPS: CadenceStep[] = [
  { key: 'cadence_1', interval: '1440 minutes', title: 'Primeiro lembrete', message: 'Olá {client_name}! Seu contrato referente a {case_title} está aguardando assinatura. Acesse o link abaixo para assinar:' },
  { key: 'cadence_2', interval: '2880 minutes', title: 'Segundo lembrete', message: 'Olá {client_name}, notamos que seu contrato de {case_title} ainda não foi assinado. Acesse o link abaixo:' },
  { key: 'cadence_3', interval: '4320 minutes', title: 'Último lembrete', message: '{client_name}, este é nosso último lembrete sobre o contrato de {case_title}. Por favor, assine pelo link:' },
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
    interval: stepCadence[key] || '1440 minutes',
    title: titleCadence[key] || key,
    message: msgCadence[key] || null,
  }));
}

export function LeadFollowupTab({ codAgent, config }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [steps, setSteps] = useState<CadenceStep[]>(DEFAULT_STEPS);

  const upsert = useUpsertContractNotificationConfig();

  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setSteps(stepsFromConfig(config));
    }
  }, [config]);

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
      type: 'LEAD_FOLLOWUP',
      is_active: isActive,
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
              <CardTitle className="text-lg">Followup de Leads</CardTitle>
              <CardDescription>
                Régua automática de cobrança para contratos gerados e não assinados
              </CardDescription>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ContractCadenceStepEditor
            steps={steps}
            onChange={setSteps}
            variables={['client_name', 'case_title', 'contract_date']}
          />

          <div className="bg-muted/50 border rounded-lg p-4 flex items-start gap-3">
            <Link className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Link do Contrato</p>
              <p className="text-xs text-muted-foreground">
                O link do contrato ZapSign será inserido automaticamente no final de cada mensagem.
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
