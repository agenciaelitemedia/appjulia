import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Save, Info, X } from 'lucide-react';
import { ContractNotificationConfig, useUpsertContractNotificationConfig } from '@/hooks/useContractNotificationConfig';

interface Props {
  codAgent: string;
  config?: ContractNotificationConfig;
}

export function OfficeNotificationTab({ codAgent, config }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [triggerEvent, setTriggerEvent] = useState('BOTH');
  const [targetNumbers, setTargetNumbers] = useState<string[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);
  const [messageTemplate, setMessageTemplate] = useState(
    '📋 *Novo contrato {trigger_label}*\n\n👤 Lead: {client_name}\n📱 Telefone: {client_phone}\n📌 Caso: {case_title}\n\n📝 Resumo:\n{case_summary}'
  );

  const upsert = useUpsertContractNotificationConfig();

  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setTriggerEvent(config.trigger_event || 'BOTH');
      setTargetNumbers(config.target_numbers || []);
      setRepeatCount(config.office_repeat_count || 1);
      if (config.message_template) setMessageTemplate(config.message_template);
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
    upsert.mutate({
      cod_agent: codAgent,
      type: 'OFFICE_ALERT',
      is_active: isActive,
      trigger_event: triggerEvent,
      target_numbers: targetNumbers,
      office_repeat_count: repeatCount,
      message_template: messageTemplate,
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

          <div className="space-y-2">
            <Label>Repetições de Alerta (contrato não assinado)</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={repeatCount}
              onChange={(e) => setRepeatCount(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Quantidade de vezes que o alerta será reenviado caso o contrato não seja assinado
            </p>
          </div>

          <div className="space-y-2">
            <Label>Template do Alerta</Label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={6}
            />
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-xs bg-muted px-2 py-1 rounded">{'{client_name}'}</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{'{client_phone}'}</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{'{case_title}'}</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{'{case_summary}'}</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{'{trigger_label}'}</span>
            </div>
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
