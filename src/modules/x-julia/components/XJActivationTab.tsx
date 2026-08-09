import { Clock, Mic, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiPhraseInput } from '@/pages/agents/components/wizard-steps/MultiPhraseInput';
import { XJBusinessHoursEditor } from './XJBusinessHoursEditor';
import {
  isWithinXJHours,
  normalizeXJBusinessHours,
  type XJBusinessHours,
  type XJSchedule,
} from '../lib/xjBusinessHours';

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { value: 'America/Belem', label: 'Belém (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { value: 'America/Recife', label: 'Recife (GMT-3)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (GMT-4)' },
];

export interface XJActivationConfig {
  session_start?: string;
  only_campaign?: boolean;
  start_campaign?: string;
  check_specialized?: string;
  restart_message?: string;
}

interface Props {
  canEdit: boolean;
  activation: XJActivationConfig;
  onActivationChange: (patch: XJActivationConfig) => void;
  businessHours: Record<string, any>;
  onBusinessHoursChange: (value: XJBusinessHours) => void;
  voiceEnabled: boolean;
  onVoiceEnabledChange: (value: boolean) => void;
}

export function XJActivationTab({
  canEdit,
  activation,
  onActivationChange,
  businessHours,
  onBusinessHoursChange,
  voiceEnabled,
  onVoiceEnabledChange,
}: Props) {
  const hours = normalizeXJBusinessHours(businessHours);
  const active = isWithinXJHours(businessHours);

  const setHours = (patch: Partial<XJBusinessHours>) => onBusinessHoursChange({ ...hours, ...patch });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Play className="h-4 w-4" /> Sessão e Campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Início da Sessão</Label>
            <p className="text-xs text-muted-foreground">
              Comandos que iniciam uma nova sessão (adicione múltiplas frases)
            </p>
            <MultiPhraseInput
              value={activation.session_start ?? ''}
              onChange={(v) => onActivationChange({ session_start: v })}
              placeholder="Ex: #start"
            />
            <p className="text-xs text-muted-foreground">
              Ao receber uma dessas frases, a sessão é reiniciada do zero (só funciona quando a entrada
              está restrita a campanha).
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Mensagem de Reinício de Sessão</Label>
            <p className="text-xs text-muted-foreground">
              Confirmação enviada ao lead quando uma nova sessão é iniciada pela frase
            </p>
            <Textarea
              rows={2}
              value={activation.restart_message ?? ''}
              onChange={(e) => onActivationChange({ restart_message: e.target.value })}
              disabled={!canEdit}
              placeholder="Prontinho! Iniciei um novo atendimento para você. Pode me contar o que precisa?"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Apenas Campanha</Label>
              <p className="text-xs text-muted-foreground">Responder apenas leads de campanha</p>
            </div>
            <Switch
              checked={!!activation.only_campaign}
              onCheckedChange={(v) => onActivationChange({ only_campaign: v })}
              disabled={!canEdit}
            />
          </div>

          {activation.only_campaign && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Com esta opção ligada, o agente <strong>não responde</strong> leads que chegarem
              fora de campanha (sem anúncio/CTA) e que não enviarem uma das frases de início de campanha.
            </p>
          )}

          <Separator />

          <div className="space-y-2">
            <Label>Início de Campanha</Label>
            <p className="text-xs text-muted-foreground">Frases que iniciam o fluxo de campanha</p>
            <MultiPhraseInput
              value={activation.start_campaign ?? ''}
              onChange={(v) => onActivationChange({ start_campaign: v })}
              placeholder="Ex: quero me aposentar"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Verificar Atendimento Especializado</Label>
            <p className="text-xs text-muted-foreground">
              Frases que transferem direto para o atendimento humano
            </p>
            <MultiPhraseInput
              value={activation.check_specialized ?? ''}
              onChange={(v) => onActivationChange({ check_specialized: v })}
              placeholder="Ex: atendimento especializado"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4" /> Áudio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Usar Áudio</Label>
              <p className="text-xs text-muted-foreground">
                Responder em áudio quando o lead enviar áudio (desligue para responder sempre em texto)
              </p>
            </div>
            <Switch checked={voiceEnabled} onCheckedChange={onVoiceEnabledChange} disabled={!canEdit} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Horário de Atuação da Julia
            {hours.enabled && (
              <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Atuando agora' : 'Fora do horário'}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar Horário de Atuação</Label>
              <p className="text-xs text-muted-foreground">
                Dentro das faixas configuradas a Julia responde; fora delas ela não atua
              </p>
            </div>
            <Switch
              checked={hours.enabled}
              onCheckedChange={(v) => setHours({ enabled: v })}
              disabled={!canEdit}
            />
          </div>

          {hours.enabled && (
            <>
              <Separator />
              <div className="space-y-2 md:max-w-sm">
                <Label>Fuso Horário</Label>
                <Select
                  value={hours.timezone}
                  onValueChange={(v) => setHours({ timezone: v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Faixas por Dia</Label>
                <p className="text-xs text-muted-foreground">
                  Cada dia aceita múltiplas faixas. Ex.: seg a sex 00:00–07:59 e 22:00–23:59; sáb e dom 00:00–23:59.
                </p>
                <XJBusinessHoursEditor
                  schedule={hours.schedule}
                  onChange={(schedule: XJSchedule) => setHours({ schedule })}
                  disabled={!canEdit}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Mensagem Fora do Horário</Label>
                <p className="text-xs text-muted-foreground">
                  Enviada uma vez quando o lead falar fora das faixas de atuação (deixe vazio para não responder)
                </p>
                <Textarea
                  rows={3}
                  value={hours.off_message}
                  onChange={(e) => setHours({ off_message: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Ex: Nosso atendimento retorna às 08:00. Já registrei sua mensagem!"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
