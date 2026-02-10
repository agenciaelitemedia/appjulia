import { useState, useEffect } from 'react';
import { Settings, Plus, X, Phone, Bot, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotificationConfig } from '../hooks/useNotificationConfig';
import { useMyAgents } from '@/pages/agente/meus-agentes/hooks/useMyAgents';

export function SettingsTab() {
  const { config, isLoading, upsertConfig } = useNotificationConfig();
  const { data: agentsData } = useMyAgents();

  const [agentCod, setAgentCod] = useState<string>('');
  const [phones, setPhones] = useState<string[]>([]);
  const [newPhone, setNewPhone] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Sync from config
  useEffect(() => {
    if (config) {
      setAgentCod(config.default_agent_cod || '');
      setPhones(config.office_phones || []);
      setIsActive(config.is_active);
    }
  }, [config]);

  const allAgents = [
    ...(agentsData?.myAgents || []),
    ...(agentsData?.monitoredAgents || []),
  ].filter(a => a.hub === 'uazapi' && a.evo_url && a.evo_apikey);

  const handleAddPhone = () => {
    const clean = newPhone.replace(/\D/g, '');
    if (clean.length >= 10 && !phones.includes(clean)) {
      setPhones([...phones, clean]);
      setNewPhone('');
    }
  };

  const handleRemovePhone = (phone: string) => {
    setPhones(phones.filter(p => p !== phone));
  };

  const handleSave = () => {
    upsertConfig.mutate({
      default_agent_cod: agentCod || null,
      office_phones: phones,
      is_active: isActive,
    });
  };

  const hasChanges = config
    ? agentCod !== (config.default_agent_cod || '') ||
      JSON.stringify(phones) !== JSON.stringify(config.office_phones || []) ||
      isActive !== config.is_active
    : true;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Notification Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Notificações
              </CardTitle>
              <CardDescription>Ative para receber alertas de movimentações</CardDescription>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardHeader>
      </Card>

      {/* Agent Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Conexão de Envio
          </CardTitle>
          <CardDescription>
            Selecione o agente com WhatsApp conectado para enviar as notificações
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum agente com conexão WhatsApp (UaZapi) encontrado.
              Configure uma conexão em "Meus Agentes" primeiro.
            </p>
          ) : (
            <Select value={agentCod} onValueChange={setAgentCod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um agente" />
              </SelectTrigger>
              <SelectContent>
                {allAgents.map((agent) => (
                  <SelectItem key={agent.cod_agent} value={agent.cod_agent}>
                    {agent.client_name || agent.business_name || agent.cod_agent}
                    {agent.evo_instancia && ` (${agent.evo_instancia})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Office Phones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Telefones do Escritório
          </CardTitle>
          <CardDescription>
            Números que receberão todas as notificações de movimentação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="5534988860163"
              onKeyDown={(e) => e.key === 'Enter' && handleAddPhone()}
            />
            <Button variant="outline" onClick={handleAddPhone}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {phones.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {phones.map((phone) => (
                <Badge key={phone} variant="secondary" className="text-sm gap-1">
                  {phone}
                  <button onClick={() => handleRemovePhone(phone)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={!hasChanges || upsertConfig.isPending} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {upsertConfig.isPending ? 'Salvando...' : 'Salvar Configurações'}
      </Button>
    </div>
  );
}
