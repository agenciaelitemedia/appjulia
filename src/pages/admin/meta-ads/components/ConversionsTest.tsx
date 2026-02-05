import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioTower, Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { Pixel } from '../types';

interface ConversionsTestProps {
  pixels: Pixel[];
  selectedPixelId: string | null;
  onSelectPixel: (pixelId: string) => void;
  onSendEvent: (
    pixelId: string,
    events: Array<{
      eventName: string;
      actionSource: string;
      userData: Record<string, unknown>;
      customData?: Record<string, unknown>;
    }>,
    testEventCode?: string
  ) => Promise<{ success: boolean; eventsReceived?: number; messages?: string[] }>;
  disabled?: boolean;
}

const EVENT_TYPES = [
  { value: 'Lead', label: 'Lead', description: 'Captação de lead' },
  { value: 'ViewContent', label: 'View Content', description: 'Visualização de conteúdo' },
  { value: 'Purchase', label: 'Purchase', description: 'Compra/Contrato' },
  { value: 'CompleteRegistration', label: 'Complete Registration', description: 'Registro completo' },
  { value: 'Contact', label: 'Contact', description: 'Contato realizado' },
  { value: 'Subscribe', label: 'Subscribe', description: 'Assinatura' },
];

const ACTION_SOURCES = [
  { value: 'website', label: 'Website' },
  { value: 'app', label: 'App' },
  { value: 'phone_call', label: 'Ligação' },
  { value: 'chat', label: 'Chat/WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'system_generated', label: 'Sistema' },
];

export function ConversionsTest({
  pixels,
  selectedPixelId,
  onSelectPixel,
  onSendEvent,
  disabled,
}: ConversionsTestProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [eventType, setEventType] = useState('Lead');
  const [actionSource, setActionSource] = useState('chat');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [value, setValue] = useState('');
  const [customData, setCustomData] = useState('');
  const [testEventCode, setTestEventCode] = useState('');
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendEvent = async () => {
    if (!selectedPixelId) {
      toast.error('Selecione um Pixel');
      return;
    }

    if (!email && !phone) {
      toast.error('Informe pelo menos email ou telefone');
      return;
    }

    setIsLoading(true);
    setLastResult(null);

    try {
      const userData: Record<string, unknown> = {};
      if (email) userData.email = email;
      if (phone) userData.phone = phone;
      if (firstName) userData.firstName = firstName;

      const eventCustomData: Record<string, unknown> = {
        leadSource: 'meta_ads_test',
      };
      
      if (value) eventCustomData.value = parseFloat(value);
      
      // Parse additional custom data
      if (customData.trim()) {
        try {
          const parsed = JSON.parse(customData);
          Object.assign(eventCustomData, parsed);
        } catch {
          toast.error('Custom data inválido (deve ser JSON)');
          setIsLoading(false);
          return;
        }
      }

      const result = await onSendEvent(
        selectedPixelId,
        [{
          eventName: eventType,
          actionSource,
          userData,
          customData: eventCustomData,
        }],
        testEventCode || undefined
      );

      if (result.success) {
        setLastResult({
          success: true,
          message: `Evento enviado! ${result.eventsReceived} evento(s) recebido(s).`,
        });
        toast.success('Evento enviado com sucesso!');
      } else {
        setLastResult({
          success: false,
          message: 'Falha ao enviar evento',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar evento';
      setLastResult({ success: false, message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RadioTower className="h-5 w-5" />
          Teste Conversions API (CAPI)
        </CardTitle>
        <CardDescription>
          Envie eventos de conversão para o Meta Pixel e valide a integração
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pixel Selection */}
        <div className="space-y-2">
          <Label>Pixel</Label>
          {pixels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {disabled ? 'Selecione uma conta de anúncios primeiro' : 'Nenhum pixel encontrado'}
            </p>
          ) : (
            <Select value={selectedPixelId || ''} onValueChange={onSelectPixel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um Pixel" />
              </SelectTrigger>
              <SelectContent>
                {pixels.map((pixel) => (
                  <SelectItem key={pixel.id} value={pixel.id}>
                    {pixel.name} ({pixel.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Event Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Evento</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={actionSource} onValueChange={setActionSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_SOURCES.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* User Data */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Dados do Usuário (PII - será hasheado)</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input
                placeholder="11999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="João"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Test Event Code */}
        <div className="space-y-2">
          <Label>Test Event Code (opcional)</Label>
          <Input
            placeholder="TEST12345"
            value={testEventCode}
            onChange={(e) => setTestEventCode(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Obtenha no Events Manager → Test Events para validar sem afetar dados reais
          </p>
        </div>

        {/* Custom Data */}
        <div className="space-y-2">
          <Label>Custom Data (JSON, opcional)</Label>
          <Textarea
            placeholder='{"campaign_id": "123", "status": "qualified"}'
            value={customData}
            onChange={(e) => setCustomData(e.target.value)}
            className="font-mono text-sm"
            rows={3}
          />
        </div>

        {/* Result */}
        {lastResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            lastResult.success 
              ? 'bg-green-500/10 border border-green-500/20' 
              : 'bg-red-500/10 border border-red-500/20'
          }`}>
            {lastResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
            <p className={`text-sm ${lastResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {lastResult.message}
            </p>
          </div>
        )}

        {/* Send Button */}
        <Button
          onClick={handleSendEvent}
          disabled={isLoading || disabled || !selectedPixelId}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Enviar Evento de Teste
        </Button>
      </CardContent>
    </Card>
  );
}
