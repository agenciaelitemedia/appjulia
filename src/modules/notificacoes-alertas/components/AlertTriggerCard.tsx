import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneListEditor } from './PhoneListEditor';
import { TemplateEditor } from './TemplateEditor';

import { ALERT_DEFAULT_TEMPLATE, type AlertMode, type AlertTriggerDef } from '../module';
import { useUpsertAlertConfig } from '../hooks/useAlertConfigs';
import { useAlertCrmStages } from '../hooks/useAlertCrmStages';
import type { AlertConfig } from '../types';

interface AlertTriggerCardProps {
  codAgent: string;
  trigger: AlertTriggerDef;
  config?: AlertConfig;
}

export function AlertTriggerCard({ codAgent, trigger, config }: AlertTriggerCardProps) {
  const upsert = useUpsertAlertConfig();
  const { data: stages = [] } = useAlertCrmStages();

  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<AlertMode>(trigger.defaultMode);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [template, setTemplate] = useState(ALERT_DEFAULT_TEMPLATE);
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [silenceMinutes, setSilenceMinutes] = useState(30);

  useEffect(() => {
    setIsActive(config?.is_active ?? false);
    setMode((config?.mode as AlertMode) ?? trigger.defaultMode);
    setRecipients(config?.recipients ?? []);
    setTemplate(config?.message_template ?? ALERT_DEFAULT_TEMPLATE);
    setStageIds(config?.stage_ids ?? []);
    setSilenceMinutes(config?.no_response_minutes ?? 30);
  }, [config, trigger.defaultMode]);

  const dirty = useMemo(() => {
    return (
      isActive !== (config?.is_active ?? false) ||
      mode !== ((config?.mode as AlertMode) ?? trigger.defaultMode) ||
      template !== (config?.message_template ?? ALERT_DEFAULT_TEMPLATE) ||
      JSON.stringify(recipients) !== JSON.stringify(config?.recipients ?? []) ||
      JSON.stringify(stageIds) !== JSON.stringify(config?.stage_ids ?? []) ||
      silenceMinutes !== (config?.no_response_minutes ?? 30)
    );
  }, [isActive, mode, recipients, template, stageIds, silenceMinutes, config, trigger.defaultMode]);

  const toggleStage = (id: string) => {
    setStageIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const save = () => {
    upsert.mutate({
      cod_agent: codAgent,
      trigger_key: trigger.key,
      is_active: isActive,
      mode,
      recipients,
      message_template: template,
      stage_ids: stageIds,
      no_response_minutes: Math.max(1, Number(silenceMinutes) || 30),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            {trigger.label}
            <Badge variant={mode === 'takeover' ? 'default' : 'secondary'} className="text-xs">
              {mode === 'takeover' ? 'Assumir' : 'Notificar'}
            </Badge>
          </CardTitle>
          <CardDescription>{trigger.description}</CardDescription>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Label className="text-xs text-muted-foreground">Ativo</Label>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm">Modo</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as AlertMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="notify">Notificar — Julia continua ativa</SelectItem>
                <SelectItem value="takeover">Assumir — pausa a Julia no contato</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <PhoneListEditor value={recipients} onChange={setRecipients} />
        </div>

        {trigger.usesSilenceMinutes && (
          <div className="space-y-2 md:max-w-xs">
            <Label className="text-sm">Minutos sem resposta do lead</Label>
            <Input
              type="number"
              min={1}
              max={10080}
              value={silenceMinutes}
              onChange={(e) => setSilenceMinutes(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Alerta dispara quando o lead ficar esse tempo sem responder a última mensagem enviada.
            </p>
          </div>
        )}


        {trigger.usesStages && (
          <div className="space-y-2">
            <Label className="text-sm">Etapas do CRM que representam esta situação</Label>
            {stages.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma etapa encontrada.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stages.map((stage) => {
                  const selected = stageIds.includes(stage.id);
                  return (
                    <Button
                      key={stage.id}
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => toggleStage(stage.id)}
                    >
                      {stage.name}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <TemplateEditor value={template} onChange={setTemplate} />

        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || upsert.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
