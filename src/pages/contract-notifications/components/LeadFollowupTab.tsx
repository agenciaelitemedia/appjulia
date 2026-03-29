import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, Info, Link } from 'lucide-react';
import { ContractNotificationConfig, useUpsertContractNotificationConfig } from '@/hooks/useContractNotificationConfig';

interface Props {
  codAgent: string;
  config?: ContractNotificationConfig;
}

export function LeadFollowupTab({ codAgent, config }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [stagesCount, setStagesCount] = useState(3);
  const [delayMinutes, setDelayMinutes] = useState(1440);
  const [messageTemplate, setMessageTemplate] = useState(
    'Olá {client_name}! Seu contrato referente a {case_title} está aguardando assinatura. Acesse o link abaixo para assinar:'
  );

  const upsert = useUpsertContractNotificationConfig();

  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setStagesCount(config.stages_count);
      setDelayMinutes(config.delay_interval_minutes);
      if (config.message_template) setMessageTemplate(config.message_template);
    }
  }, [config]);

  const handleSave = () => {
    upsert.mutate({
      cod_agent: codAgent,
      type: 'LEAD_FOLLOWUP',
      is_active: isActive,
      stages_count: stagesCount,
      delay_interval_minutes: delayMinutes,
      message_template: messageTemplate,
    });
  };

  const delayHours = Math.round((delayMinutes / 60) * 10) / 10;

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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantidade de Etapas</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={stagesCount}
                onChange={(e) => setStagesCount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Máximo de mensagens enviadas por contrato (1-10)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Intervalo entre Envios (minutos)</Label>
              <Input
                type="number"
                min={60}
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                ≈ {delayHours} horas entre cada mensagem
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Template da Mensagem</Label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={4}
              placeholder="Use {client_name} e {case_title} como variáveis..."
            />
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-xs bg-muted px-2 py-1 rounded">{'{client_name}'}</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{'{case_title}'}</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{'{contract_date}'}</span>
            </div>
          </div>

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
