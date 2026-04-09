import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Bot, Check, Eye, Pencil, Phone, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserAgent } from '../types';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { useConnectedPhoneInfo } from '../hooks/useConnectedPhoneInfo';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { ConnectionControlButtons } from './ConnectionControlButtons';
import { useAgentAliases, getDefaultAlias } from '@/hooks/useAgentAliases';
import { toast } from 'sonner';

interface AgentCardProps {
  agent: UserAgent;
  isMonitored?: boolean;
}

export function AgentCard({ agent, isMonitored = false }: AgentCardProps) {
  const navigate = useNavigate();
  const { getAlias, upsertAlias } = useAgentAliases();
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [editValue, setEditValue] = useState('');

  const { data: connectionStatus = 'no_config', isLoading } = useConnectionStatus(
    agent.hub,
    agent.evo_url,
    agent.evo_apikey,
    agent.evo_instancia,
    agent.waba_configured,
    agent.agent_id_from_agents
  );
  const { data: phoneInfo } = useConnectedPhoneInfo(
    agent.hub,
    agent.evo_url,
    agent.evo_apikey,
    agent.evo_instancia,
    connectionStatus,
  );

  const alias = getAlias(agent.cod_agent, agent.business_name);

  const leadsPercentage = agent.plan_limit 
    ? Math.min((agent.leads_received / agent.plan_limit) * 100, 100)
    : 0;

  const canEdit = !isMonitored && (agent.can_edit_config || agent.can_edit_prompt);

  const providerLabel = agent.hub === 'waba' ? 'API Oficial' : agent.hub === 'uazapi' ? 'UaZapi' : null;

  const handleStartEdit = () => {
    setEditValue(alias || getDefaultAlias(agent.business_name));
    setIsEditingAlias(true);
  };

  const handleSaveAlias = () => {
    if (!editValue.trim()) return;
    upsertAlias.mutate(
      { codAgent: agent.cod_agent, alias: editValue.trim() },
      {
        onSuccess: () => {
          setIsEditingAlias(false);
          toast.success('Alias atualizado');
        },
        onError: () => toast.error('Erro ao salvar alias'),
      }
    );
  };

  const handleCancelEdit = () => {
    setIsEditingAlias(false);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header com badges */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {isMonitored ? (
              <Eye className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Bot className="w-4 h-4 text-primary" />
            )}
            <Badge variant={agent.status ? "default" : "secondary"}>
              {agent.status ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <ConnectionStatusBadge status={connectionStatus} isLoading={isLoading} />
        </div>

        {/* Título: #cod_agent - Alias */}
        <div className="flex items-center gap-1 mb-1">
          {isEditingAlias ? (
            <div className="flex items-center gap-1 w-full">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-7 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveAlias();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleSaveAlias} disabled={upsertAlias.isPending}>
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCancelEdit}>
                <X className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-foreground truncate">
                #{agent.cod_agent} - {alias || agent.business_name || agent.client_name || 'Sem nome'}
              </h3>
              {!isMonitored && (
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={handleStartEdit}>
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
            </>
          )}
        </div>

        {/* Dados do telefone conectado (UaZapi) - logo abaixo do título */}
        {phoneInfo && connectionStatus === 'connected' && (
          <div className="flex items-center gap-2 mb-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={phoneInfo.profilePictureUrl || undefined} />
              <AvatarFallback className="text-[8px] bg-muted">
                <Phone className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {phoneInfo.pushName && (
                <p className="text-xs font-medium text-foreground truncate">{phoneInfo.pushName}</p>
              )}
              {phoneInfo.phone && (
                <p className="text-xs text-muted-foreground truncate">{phoneInfo.phone}</p>
              )}
            </div>
          </div>
        )}

        {/* Provider info */}
        {providerLabel && (
          <p className="text-xs text-muted-foreground mb-1">
            Provider: {providerLabel}
          </p>
        )}

        {/* Instância WhatsApp (se UaZapi configurada) */}
        {agent.hub === 'uazapi' && agent.evo_instancia && (
          <p className="text-xs text-muted-foreground mb-2 truncate">
            Instância: {agent.evo_instancia}
          </p>
        )}

        {/* Dados do telefone conectado (UaZapi) */}
        {phoneInfo && connectionStatus === 'connected' && (
          <div className="flex items-center gap-2 mb-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={phoneInfo.profilePictureUrl || undefined} />
              <AvatarFallback className="text-[8px] bg-muted">
                <Phone className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {phoneInfo.pushName && (
                <p className="text-xs font-medium text-foreground truncate">{phoneInfo.pushName}</p>
              )}
              {phoneInfo.phone && (
                <p className="text-xs text-muted-foreground truncate">{phoneInfo.phone}</p>
              )}
            </div>
          </div>
        )}

        {agent.hub === 'waba' && agent.waba_number_id && (
          <p className="text-xs text-muted-foreground mb-2 truncate">
            Phone ID: {agent.waba_number_id}
          </p>
        )}

        <p className="text-sm text-muted-foreground mb-3">
          Plano: {agent.plan_name || 'Não definido'}
        </p>

        {agent.plan_limit && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Leads do mês</span>
              <span className="font-medium">
                {agent.leads_received}/{agent.plan_limit}
              </span>
            </div>
            <Progress value={leadsPercentage} className="h-2" />
          </div>
        )}

        {/* Botões de controle */}
        {!isMonitored && (
          <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between">
            <ConnectionControlButtons
              agent={agent}
              status={connectionStatus}
              isLoading={isLoading}
            />
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/agente/meus-agentes/${agent.cod_agent}/editar`)}
              >
                <Pencil className="w-4 h-4 mr-1" />
                Editar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
