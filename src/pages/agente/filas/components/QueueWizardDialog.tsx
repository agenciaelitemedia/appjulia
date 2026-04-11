import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, Globe, Instagram, Loader2, ArrowLeft, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { useQueueProviders, type QueueProvider } from '@/pages/configuracoes/hooks/useQueueProviders';
import { useQueueMutations, type QueueFormData } from '../hooks/useQueues';

const channelTypes = [
  { value: 'uazapi', label: 'UaZapi', description: 'WhatsApp não-oficial via UaZapi', icon: Phone, color: 'text-green-600 bg-green-50' },
  { value: 'waba', label: 'API Oficial (WABA)', description: 'WhatsApp Business API oficial da Meta', icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
  { value: 'webchat', label: 'WebChat', description: 'Chat integrado ao seu site', icon: Globe, color: 'text-purple-600 bg-purple-50' },
  { value: 'instagram', label: 'Instagram', description: 'Mensagens do Instagram via Meta', icon: Instagram, color: 'text-pink-600 bg-pink-50' },
];

interface QueueWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QueueWizardDialog({ open, onOpenChange }: QueueWizardDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [queueName, setQueueName] = useState('');
  // WABA-specific
  const [wabaNumberId, setWabaNumberId] = useState('');

  const { data: allProviders = [] } = useQueueProviders();
  const { createQueue } = useQueueMutations();

  // Auto-generate UaZapi instance name
  const evoInstance = useMemo(() => {
    if (selectedType !== 'uazapi') return '';
    const uid = user?.id || '0';
    const uuid = crypto.randomUUID().split('-')[0];
    return `QUEUE_${uid}_${uuid}`;
  }, [selectedType, user?.id]);

  const filteredProviders = allProviders.filter(
    (p) => p.provider_type === selectedType && p.is_active
  );

  const selectedProvider = allProviders.find((p) => p.id === selectedProviderId) || null;

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedType('');
      setSelectedProviderId('');
      setQueueName('');
      setWabaNumberId('');
    }
  }, [open]);

  // Auto-select provider if only one exists
  useEffect(() => {
    if (filteredProviders.length === 1) {
      setSelectedProviderId(filteredProviders[0].id);
    } else {
      setSelectedProviderId('');
    }
  }, [selectedType, filteredProviders.length]);

  const canGoStep2 = !!selectedType;
  const canGoStep3 = selectedType === 'webchat'
    ? true
    : selectedType === 'uazapi'
    ? !!selectedProviderId
    : !!selectedProviderId && (
      selectedType === 'waba' ? !!wabaNumberId.trim() :
      true
    );
  const canSubmit = !!queueName.trim();

  const handleSubmit = () => {
    const formData: QueueFormData = {
      name: queueName.trim(),
      channel_type: selectedType,
      hub: selectedType,
    };

    if (selectedProvider) {
      if (selectedType === 'uazapi') {
        formData.evo_url = selectedProvider.evo_url || undefined;
        formData.evo_apikey = selectedProvider.evo_apikey || undefined;
        formData.evo_instance = evoInstance || undefined;
      } else if (selectedType === 'waba') {
        formData.waba_id = selectedProvider.waba_business_id || undefined;
        formData.waba_token = selectedProvider.waba_token || undefined;
        formData.waba_number_id = wabaNumberId || undefined;
      }
    }

    createQueue.mutate(formData, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Fila de Atendimento</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Escolha o canal de comunicação'}
            {step === 2 && 'Configure o provedor e os dados do canal'}
            {step === 3 && 'Dê um nome e confirme a criação'}
          </DialogDescription>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s < step ? 'bg-primary text-primary-foreground' :
                s === step ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Channel selection */}
        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {channelTypes.map((ch) => {
              const Icon = ch.icon;
              const hasProvider = allProviders.some((p) => p.provider_type === ch.value && p.is_active);
              const isWebchat = ch.value === 'webchat';

              return (
                <Card
                  key={ch.value}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedType === ch.value ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedType(ch.value)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ch.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{ch.label}</p>
                        {!isWebchat && (
                          <Badge variant={hasProvider ? 'default' : 'outline'} className="text-xs mt-0.5">
                            {hasProvider ? 'Provedor configurado' : 'Sem provedor'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{ch.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Step 2: Provider config */}
        {step === 2 && (
          <div className="space-y-4">
            {selectedType === 'webchat' ? (
              <div className="p-4 border border-border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  O WebChat não requer configuração de provedor externo. Prossiga para a próxima etapa.
                </p>
              </div>
            ) : filteredProviders.length === 0 ? (
              <div className="flex items-center gap-3 p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Nenhum provedor configurado</p>
                  <p className="text-xs text-muted-foreground">
                    Vá em Configurações → Provedores de Fila para adicionar um provedor do tipo{' '}
                    {channelTypes.find((c) => c.value === selectedType)?.label}.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <Label>Provedor</Label>
                  <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o provedor" /></SelectTrigger>
                    <SelectContent>
                      {filteredProviders.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedType === 'uazapi' && selectedProviderId && (
                  <div className="p-3 border border-border rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      A instância será criada automaticamente com o nome <strong className="text-foreground">{evoInstance}</strong>.
                    </p>
                  </div>
                )}

                {selectedType === 'waba' && selectedProviderId && (
                  <div>
                    <Label>Phone Number ID</Label>
                    <Input
                      value={wabaNumberId}
                      onChange={(e) => setWabaNumberId(e.target.value)}
                      placeholder="ID do número no Meta Business"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      ID do número de telefone registrado na WABA
                    </p>
                  </div>
                )}

                {selectedType === 'instagram' && selectedProviderId && (
                  <div className="p-3 border border-border rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      A conexão do Instagram será feita usando o provedor <strong>{selectedProvider?.name}</strong> (Page: {selectedProvider?.page_name || 'N/A'}).
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Name & confirmation */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label>Nome da Fila</Label>
              <Input
                value={queueName}
                onChange={(e) => setQueueName(e.target.value)}
                placeholder="Ex: WhatsApp Principal"
                autoFocus
              />
            </div>

            <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-2">
              <p className="text-sm font-medium text-foreground">Resumo</p>
              <div className="grid gap-1 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Canal:</span> {channelTypes.find((c) => c.value === selectedType)?.label}</p>
                {selectedProvider && (
                  <p><span className="font-medium text-foreground">Provedor:</span> {selectedProvider.name}</p>
                )}
                {selectedType === 'uazapi' && evoInstance && (
                  <p><span className="font-medium text-foreground">Instância:</span> {evoInstance}</p>
                )}
                {selectedType === 'waba' && wabaNumberId && (
                  <p><span className="font-medium text-foreground">Phone Number ID:</span> {wabaNumberId}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !canGoStep2 : !canGoStep3}
              >
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canSubmit || createQueue.isPending}>
                {createQueue.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Fila
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
