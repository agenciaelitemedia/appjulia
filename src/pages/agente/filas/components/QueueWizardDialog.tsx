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
import { Phone, MessageSquare, Globe, Instagram, Loader2, ArrowLeft, ArrowRight, Check, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useQueueProviders } from '@/pages/configuracoes/hooks/useQueueProviders';
import { useQueueMutations, useQueues, type QueueFormData } from '../hooks/useQueues';
import { useAgentQueueLimits } from '../hooks/useAgentQueueLimits';
import { WabaEmbeddedSignupButton } from '@/components/waba/WabaEmbeddedSignupButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

type WabaPhoneNumber = {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
};

export function QueueWizardDialog({ open, onOpenChange }: QueueWizardDialogProps) {
  const { user, isAdmin } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [queueName, setQueueName] = useState('');
  // WABA-specific (self-contained: stored in wizard state, not in queue_providers)
  const [wabaAccessToken, setWabaAccessToken] = useState('');
  const [wabaBusinessId, setWabaBusinessId] = useState('');
  const [wabaNumberId, setWabaNumberId] = useState('');
  const [wabaNumbers, setWabaNumbers] = useState<WabaPhoneNumber[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [numbersError, setNumbersError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);

  const { data: allProviders = [] } = useQueueProviders();
  const { createQueue } = useQueueMutations();
  const { data: existingQueues = [] } = useQueues(false);
  const { data: limits } = useAgentQueueLimits();
  const queueLimit = limits?.queueLimit ?? 1;
  const activeCount = existingQueues.filter((q) => !q.is_deleted).length;
  const limitReached = activeCount >= queueLimit;

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
      setWabaAccessToken('');
      setWabaBusinessId('');
      setWabaNumberId('');
      setWabaNumbers([]);
      setNumbersError(null);
      setTestOk(null);
    }
  }, [open]);

  useEffect(() => {
    if (selectedType === 'waba') {
      setSelectedProviderId('');
    } else if (filteredProviders.length === 1) {
      setSelectedProviderId(filteredProviders[0].id);
    } else {
      setSelectedProviderId('');
    }
    setWabaNumberId('');
    setWabaNumbers([]);
    setTestOk(null);
  }, [selectedType, filteredProviders.length]);

  useEffect(() => {
    if (selectedType !== 'waba' || !wabaBusinessId || !wabaAccessToken) {
      setWabaNumbers([]);
      return;
    }
    let cancelled = false;
    setLoadingNumbers(true);
    setNumbersError(null);
    supabase.functions
      .invoke('waba-admin', {
        body: {
          action: 'list_phone_numbers',
          wabaBusinessId,
          accessToken: wabaAccessToken,
        },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.success) {
          setNumbersError(data?.error || error?.message || 'Falha ao listar números');
          setWabaNumbers([]);
        } else {
          setWabaNumbers(data.numbers || []);
          if (data.numbers?.length === 1) setWabaNumberId(data.numbers[0].id);
        }
      })
      .finally(() => { if (!cancelled) setLoadingNumbers(false); });
    return () => { cancelled = true; };
  }, [selectedType, wabaBusinessId, wabaAccessToken]);

  const handleTestConnection = async () => {
    if (!wabaAccessToken || !wabaNumberId) return;
    setTesting(true);
    setTestOk(null);
    const { data, error } = await supabase.functions.invoke('waba-admin', {
      body: {
        action: 'test_credentials',
        accessToken: wabaAccessToken,
        phoneNumberId: wabaNumberId,
      },
    });
    setTesting(false);
    if (error || !data?.success) {
      setTestOk(false);
      toast.error(`Falha: ${data?.error || error?.message || 'erro desconhecido'}`);
    } else {
      setTestOk(true);
      toast.success(`Conexão OK — ${data.phone} (${data.verified_name || 'sem nome'})`);
    }
  };

  const handleWabaSignupSuccess = (result: { accessToken: string; wabaBusinessId: string; phoneNumberId: string }) => {
    setWabaAccessToken(result.accessToken);
    setWabaBusinessId(result.wabaBusinessId);
    if (result.phoneNumberId) setWabaNumberId(result.phoneNumberId);
    setTestOk(null);
    toast.success('Conta Meta conectada — selecione o número');
  };

  const handleWabaReconnect = () => {
    setWabaAccessToken('');
    setWabaBusinessId('');
    setWabaNumberId('');
    setWabaNumbers([]);
    setNumbersError(null);
    setTestOk(null);
  };

  const qualityColor = (rating: string) =>
    rating === 'GREEN' ? 'bg-emerald-500' : rating === 'YELLOW' ? 'bg-yellow-500' : rating === 'RED' ? 'bg-red-500' : 'bg-muted-foreground';

  const canGoStep2 = !!selectedType;
  const canGoStep3 =
    selectedType === 'webchat' ? true :
    selectedType === 'waba' ? (!!wabaAccessToken && !!wabaBusinessId && !!wabaNumberId.trim()) :
    !!selectedProviderId;
  const canSubmit = !!queueName.trim();

  const handleSubmit = () => {
    if (limitReached) {
      toast.error(`Limite de ${queueLimit} ${queueLimit === 1 ? 'fila atingido' : 'filas atingido'}. Contate seu administrador para aumentar.`);
      return;
    }
    const formData: QueueFormData = {
      name: queueName.trim(),
      channel_type: selectedType,
      hub: selectedType,
    };

    if (selectedType === 'waba') {
      formData.waba_id = wabaBusinessId || undefined;
      formData.waba_token = wabaAccessToken || undefined;
      formData.waba_number_id = wabaNumberId || undefined;
    } else if (selectedProvider) {
      if (selectedType === 'uazapi') {
        formData.evo_url = selectedProvider.evo_url || undefined;
        formData.evo_apikey = selectedProvider.evo_apikey || undefined;
        formData.evo_instance = evoInstance || undefined;
      }
    }

    createQueue.mutate(formData, {
      onSuccess: async (created: any) => {
        // O server (queue-management) já dispara subscribe_queue automaticamente
        // e persiste o status em queues.waba_webhook_status. Aqui apenas surfacemos
        // o resultado real para o usuário quando for WABA.
        if (selectedType === 'waba') {
          const webhook = (created as any)?.waba_webhook;
          if (webhook && webhook.success === false) {
            const detail = webhook.error || 'erro desconhecido';
            toast.warning(
              `Fila criada, mas o webhook Meta não foi inscrito: ${detail}. Use "Reinscrever webhook" no menu da fila.`,
              { duration: 8000 },
            );
          } else if (webhook && webhook.success === true) {
            toast.success('Webhook Meta inscrito com sucesso');
          }
        }
        onOpenChange(false);
      },
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
              const isWaba = ch.value === 'waba';
              const isWebchat = ch.value === 'webchat';
              const isInstagram = ch.value === 'instagram';
              const hasProvider = allProviders.some((p) => p.provider_type === ch.value && p.is_active);
              const adminOnly = isWebchat || isInstagram;
              const isDisabled = adminOnly && !isAdmin;

              return (
                <Card
                  key={ch.value}
                  className={`transition-all ${
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer hover:shadow-md'
                  } ${selectedType === ch.value ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => {
                    if (isDisabled) return;
                    setSelectedType(ch.value);
                  }}
                  title={isDisabled ? 'Disponível apenas para administradores' : undefined}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ch.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{ch.label}</p>
                        {isDisabled ? (
                          <Badge variant="outline" className="text-xs mt-0.5">
                            Em breve
                          </Badge>
                        ) : !isWebchat && (
                          <Badge variant={isWaba || hasProvider ? 'default' : 'outline'} className="text-xs mt-0.5">
                            {isWaba ? 'Conecte ao criar' : hasProvider ? 'Provedor configurado' : 'Sem provedor'}
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
            ) : selectedType === 'waba' ? (
              <div className="space-y-4">
                {!wabaAccessToken || !wabaBusinessId ? (
                  <div className="space-y-3">
                    <div className="p-4 border border-border rounded-lg bg-muted/40 space-y-2">
                      <p className="text-sm font-medium text-foreground">Conectar conta Meta</p>
                      <p className="text-xs text-muted-foreground">
                        Faça login com a conta Meta do cliente para autorizar a API Oficial do WhatsApp.
                        Os tokens ficarão vinculados apenas a esta fila.
                      </p>
                    </div>
                    <WabaEmbeddedSignupButton
                      label="Conectar conta Meta agora"
                      onSuccess={handleWabaSignupSuccess}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 p-3 border border-emerald-200 rounded-lg bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-medium text-foreground">Conta Meta conectada</p>
                          <p className="text-muted-foreground">Business ID: {wabaBusinessId}</p>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={handleWabaReconnect}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reconectar
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Número do WhatsApp (Phone Number ID)</Label>
                      {loadingNumbers ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border border-border rounded-md">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Buscando números na conta WABA...
                        </div>
                      ) : numbersError ? (
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 p-3 border border-destructive/30 rounded-md bg-destructive/5">
                            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-foreground">
                              <p className="font-medium">Não foi possível listar os números</p>
                              <p className="text-muted-foreground">{numbersError}</p>
                            </div>
                          </div>
                          <Input
                            value={wabaNumberId}
                            onChange={(e) => setWabaNumberId(e.target.value)}
                            placeholder="Cole o Phone Number ID manualmente"
                          />
                        </div>
                      ) : wabaNumbers.length > 0 ? (
                        <Select value={wabaNumberId} onValueChange={(v) => { setWabaNumberId(v); setTestOk(null); }}>
                          <SelectTrigger><SelectValue placeholder="Selecione o número" /></SelectTrigger>
                          <SelectContent>
                            {wabaNumbers.map((n) => (
                              <SelectItem key={n.id} value={n.id}>
                                <span className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${qualityColor(n.quality_rating)}`} />
                                  {n.display_phone_number} — {n.verified_name || 'sem nome'}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={wabaNumberId}
                          onChange={(e) => setWabaNumberId(e.target.value)}
                          placeholder="Phone Number ID"
                        />
                      )}

                      {wabaNumberId && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleTestConnection}
                            disabled={testing}
                          >
                            {testing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                            Testar conexão
                          </Button>
                          {testOk === true && (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Token válido
                            </span>
                          )}
                          {testOk === false && (
                            <span className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Falhou
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : filteredProviders.length === 0 ? (
              <div className="flex items-center gap-3 p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Nenhum provedor configurado</p>
                  <p className="text-xs text-muted-foreground">
                    Vá em Configurações → Provedores de Fila para adicionar um provedor do tipo {channelTypes.find((c) => c.value === selectedType)?.label}.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    As filas utilizam o provedor configurado. Um provedor pode ser compartilhado por qualquer cliente.
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
              <Button onClick={handleSubmit} disabled={!canSubmit || createQueue.isPending || limitReached}>
                {createQueue.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {limitReached ? `Limite atingido (${queueLimit})` : 'Criar Fila'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
