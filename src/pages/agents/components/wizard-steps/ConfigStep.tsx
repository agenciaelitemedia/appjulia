import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormLabel, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Bell, Phone, Play, FileText, Video, Clock, Sparkles } from 'lucide-react';
import { MultiPhraseInput } from './MultiPhraseInput';
import { BusinessHoursEditor, type BusinessHoursSchedule } from './BusinessHoursEditor';
import type { AgentFormData } from '../CreateAgentWizard';

interface ConfigFields {
  COPILOT_ENABLED: boolean;
  COPILOT_INTERACTIVE: boolean;
  CHAT_RESUME: boolean;
  ONLY_ME_RESUME: boolean;
  NOTIFY_RESUME: string;
  USING_AUDIO: boolean;
  FOLLOWUP_CALL: boolean;
  SESSION_START: string;
  ONLY_CAMPAIGN: boolean;
  START_CAMPAIGN: string;
  NOTIFY_DOC_SIGNED: string;
  NOTIFY_DOC_CREATED: string;
  SESSION_CHECK_SPECIALIZED: string;
  CONTRACT_SIGNED: string;
  VIDEO_CONTRACT_SIGNED: string;
  VIDEO_CONTRACT_CREATED: string;
  BUSINESS_HOURS_ENABLED: boolean;
  BUSINESS_HOURS_TIMEZONE: string;
  BUSINESS_HOURS_SCHEDULE: BusinessHoursSchedule;
  BUSINESS_HOURS_OFF_MESSAGE: string;
}

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

const DEFAULT_BUSINESS_HOURS_SCHEDULE: BusinessHoursSchedule = {
  monday: { enabled: true, start: '08:00', end: '18:00' },
  tuesday: { enabled: true, start: '08:00', end: '18:00' },
  wednesday: { enabled: true, start: '08:00', end: '18:00' },
  thursday: { enabled: true, start: '08:00', end: '18:00' },
  friday: { enabled: true, start: '08:00', end: '17:00' },
  saturday: { enabled: false, start: '09:00', end: '13:00' },
  sunday: { enabled: false, start: '00:00', end: '00:00' },
};

const DEFAULT_CONFIG: ConfigFields = {
  COPILOT_ENABLED: false,
  COPILOT_INTERACTIVE: false,
  CHAT_RESUME: true,
  ONLY_ME_RESUME: true,
  NOTIFY_RESUME: '',
  USING_AUDIO: true,
  FOLLOWUP_CALL: true,
  SESSION_START: '#start',
  ONLY_CAMPAIGN: false,
  START_CAMPAIGN: 'quero me aposentar',
  NOTIFY_DOC_SIGNED: '',
  NOTIFY_DOC_CREATED: '',
  SESSION_CHECK_SPECIALIZED: 'atendimento especializado',
  CONTRACT_SIGNED: 'Olha que legal. Acabei de receber o seu documento assinado. Agora vou te transferir para o atendimento especializado. Aguarde que logo alguém continuará a falar com você.',
  VIDEO_CONTRACT_SIGNED: '',
  VIDEO_CONTRACT_CREATED: '',
  BUSINESS_HOURS_ENABLED: false,
  BUSINESS_HOURS_TIMEZONE: 'America/Sao_Paulo',
  BUSINESS_HOURS_SCHEDULE: DEFAULT_BUSINESS_HOURS_SCHEDULE,
  BUSINESS_HOURS_OFF_MESSAGE: 'Olá! No momento estamos fora do horário de atendimento. Nosso horário de funcionamento é de segunda a sexta, das 08:00 às 18:00. Retornaremos assim que possível!',
};

export function ConfigStep() {
  const { watch, setValue } = useFormContext<AgentFormData>();
  const configJson = watch('config_json');

  // Parse JSON to get current config values
  const parseConfig = (): ConfigFields => {
    try {
      const parsed = JSON.parse(configJson);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      return DEFAULT_CONFIG;
    }
  };

  const config = parseConfig();

  // Update a single field and serialize back to JSON
  const updateField = <K extends keyof ConfigFields>(key: K, value: ConfigFields[K]) => {
    const currentConfig = parseConfig();
    const newConfig = { ...currentConfig, [key]: value };
    setValue('config_json', JSON.stringify(newConfig, null, 2));
  };

  // Initialize with default config if empty
  useEffect(() => {
    if (configJson === '{\n  \n}' || configJson === '{}') {
      setValue('config_json', JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Configurações do Agente</h3>
        <p className="text-sm text-muted-foreground">
          Configure as opções de comportamento do agente
        </p>
      </div>

      {/* Copilot Section - Highlighted */}
      <Card className="border-2 border-primary bg-primary/5 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            Copiloto Julia IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel className="text-sm font-medium">Ativar Copiloto Inteligente</FormLabel>
              <FormDescription>
                Análise automática do CRM com insights inteligentes em tempo real. 
                Receba alertas sobre leads parados, oportunidades quentes e riscos.
              </FormDescription>
            </div>
            <Switch
              checked={config.COPILOT_ENABLED}
              onCheckedChange={(checked) => {
                updateField('COPILOT_ENABLED', checked);
                if (!checked) updateField('COPILOT_INTERACTIVE', false);
              }}
              className="scale-125"
            />
          </div>

          {config.COPILOT_ENABLED && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">Copiloto Interativo (Chat)</FormLabel>
                  <FormDescription>
                    Habilita um chat onde você pode fazer perguntas sobre seus leads em tempo real.
                  </FormDescription>
                </div>
                <Switch
                  checked={config.COPILOT_INTERACTIVE}
                  onCheckedChange={(checked) => updateField('COPILOT_INTERACTIVE', checked)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Chat & Resume Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat e Resumo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel>Resumo do Chat</FormLabel>
              <FormDescription>Ativar resumo automático das conversas</FormDescription>
            </div>
            <Switch
              checked={config.CHAT_RESUME}
              onCheckedChange={(checked) => updateField('CHAT_RESUME', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel>Apenas Meu Resumo</FormLabel>
              <FormDescription>Receber apenas resumos próprios</FormDescription>
            </div>
            <Switch
              checked={config.ONLY_ME_RESUME}
              onCheckedChange={(checked) => updateField('ONLY_ME_RESUME', checked)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <FormLabel>Notificar Resumo</FormLabel>
            <FormDescription>Número ou grupo para notificação de resumos</FormDescription>
            <Input
              value={config.NOTIFY_RESUME}
              onChange={(e) => updateField('NOTIFY_RESUME', e.target.value)}
              placeholder="Ex: 5511999999999 ou ID do grupo"
            />
          </div>
        </CardContent>
      </Card>

      {/* Audio & Calls Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Áudio e Ligações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel>Usar Áudio</FormLabel>
              <FormDescription>Permitir envio e recebimento de áudios</FormDescription>
            </div>
            <Switch
              checked={config.USING_AUDIO}
              onCheckedChange={(checked) => updateField('USING_AUDIO', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel>Followup por Ligação</FormLabel>
              <FormDescription>Ativar ligações no fluxo de followup</FormDescription>
            </div>
            <Switch
              checked={config.FOLLOWUP_CALL}
              onCheckedChange={(checked) => updateField('FOLLOWUP_CALL', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Session Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4" />
            Sessão e Campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <FormLabel>Início da Sessão</FormLabel>
            <FormDescription>Comandos para iniciar uma nova sessão (adicione múltiplas frases)</FormDescription>
            <MultiPhraseInput
              value={config.SESSION_START}
              onChange={(value) => updateField('SESSION_START', value)}
              placeholder="Ex: #start"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel>Apenas Campanha</FormLabel>
              <FormDescription>Responder apenas leads de campanha</FormDescription>
            </div>
            <Switch
              checked={config.ONLY_CAMPAIGN}
              onCheckedChange={(checked) => updateField('ONLY_CAMPAIGN', checked)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <FormLabel>Início de Campanha</FormLabel>
            <FormDescription>Frases que iniciam o fluxo de campanha (adicione múltiplas)</FormDescription>
            <MultiPhraseInput
              value={config.START_CAMPAIGN}
              onChange={(value) => updateField('START_CAMPAIGN', value)}
              placeholder="Ex: quero me aposentar"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <FormLabel>Verificar Atendimento Especializado</FormLabel>
            <FormDescription>Frases para transferir ao atendimento especializado (adicione múltiplas)</FormDescription>
            <MultiPhraseInput
              value={config.SESSION_CHECK_SPECIALIZED}
              onChange={(value) => updateField('SESSION_CHECK_SPECIALIZED', value)}
              placeholder="Ex: atendimento especializado"
            />
          </div>
        </CardContent>
      </Card>

      {/* Business Hours Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horário de Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel>Ativar Horário Comercial</FormLabel>
              <FormDescription>Limitar atendimento a horários específicos</FormDescription>
            </div>
            <Switch
              checked={config.BUSINESS_HOURS_ENABLED}
              onCheckedChange={(checked) => updateField('BUSINESS_HOURS_ENABLED', checked)}
            />
          </div>

          {config.BUSINESS_HOURS_ENABLED && (
            <>
              <Separator />

              <div className="space-y-2">
                <FormLabel>Fuso Horário</FormLabel>
                <Select
                  value={config.BUSINESS_HOURS_TIMEZONE}
                  onValueChange={(value) => updateField('BUSINESS_HOURS_TIMEZONE', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fuso horário" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <FormLabel>Horários por Dia</FormLabel>
                <FormDescription>Configure os horários de atendimento para cada dia da semana</FormDescription>
                <BusinessHoursEditor
                  schedule={config.BUSINESS_HOURS_SCHEDULE}
                  onChange={(schedule) => updateField('BUSINESS_HOURS_SCHEDULE', schedule)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <FormLabel>Mensagem Fora do Horário</FormLabel>
                <FormDescription>Mensagem automática enviada quando receber mensagem fora do expediente</FormDescription>
                <Textarea
                  value={config.BUSINESS_HOURS_OFF_MESSAGE}
                  onChange={(e) => updateField('BUSINESS_HOURS_OFF_MESSAGE', e.target.value)}
                  placeholder="Mensagem para enviar fora do horário de atendimento..."
                  className="min-h-[100px] resize-y"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificações de Documentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <FormLabel>Notificar Documento Assinado</FormLabel>
            <FormDescription>Número para notificação quando documento for assinado</FormDescription>
            <Input
              value={config.NOTIFY_DOC_SIGNED}
              onChange={(e) => updateField('NOTIFY_DOC_SIGNED', e.target.value)}
              placeholder="Ex: 5511999999999"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <FormLabel>Notificar Documento Criado</FormLabel>
            <FormDescription>Número para notificação quando documento for criado</FormDescription>
            <Input
              value={config.NOTIFY_DOC_CREATED}
              onChange={(e) => updateField('NOTIFY_DOC_CREATED', e.target.value)}
              placeholder="Ex: 5511999999999"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contract Messages Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Mensagens de Contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <FormLabel>Mensagem Contrato Assinado</FormLabel>
            <FormDescription>Mensagem enviada quando o contrato é assinado</FormDescription>
            <Textarea
              value={config.CONTRACT_SIGNED}
              onChange={(e) => updateField('CONTRACT_SIGNED', e.target.value)}
              placeholder="Mensagem para o cliente após assinatura..."
              className="min-h-[100px] resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {/* Video Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4" />
            Vídeos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <FormLabel>Vídeo Contrato Assinado</FormLabel>
            <FormDescription>URL do vídeo enviado após assinatura do contrato</FormDescription>
            <Input
              value={config.VIDEO_CONTRACT_SIGNED}
              onChange={(e) => updateField('VIDEO_CONTRACT_SIGNED', e.target.value)}
              placeholder="https://..."
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <FormLabel>Vídeo Contrato Criado</FormLabel>
            <FormDescription>URL do vídeo enviado após criação do contrato</FormDescription>
            <Input
              value={config.VIDEO_CONTRACT_CREATED}
              onChange={(e) => updateField('VIDEO_CONTRACT_CREATED', e.target.value)}
              placeholder="https://..."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
