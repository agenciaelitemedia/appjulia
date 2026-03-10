import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save, Settings, MessageSquare, Loader2 } from 'lucide-react';
import { ConfigStep } from '@/pages/agents/components/wizard-steps/ConfigStep';
import { PromptStep } from '@/pages/agents/components/wizard-steps/PromptStep';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { useMyAgents } from './hooks/useMyAgents';
import { toast } from 'sonner';

interface AgentDetails {
  id: number;
  cod_agent: string;
  status: boolean;
  settings: string | Record<string, unknown>;
  prompt: string;
  client_name: string;
  business_name: string | null;
}

interface MyAgentFormData {
  config_json: string;
  system_prompt: string;
}

export default function MyAgentEditPage() {
  const { codAgent } = useParams<{ codAgent: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: agentsData } = useMyAgents();
  
  const [agent, setAgent] = useState<AgentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Find permissions from user_agents
  const userAgent = agentsData?.myAgents.find(a => a.cod_agent === codAgent);
  const canEditConfig = userAgent?.can_edit_config ?? false;
  const canEditPrompt = userAgent?.can_edit_prompt ?? false;

  const methods = useForm<MyAgentFormData>({
    defaultValues: {
      config_json: '{}',
      system_prompt: '',
    },
  });

  // Determine default tab
  const defaultTab = canEditConfig ? 'config' : canEditPrompt ? 'prompt' : 'config';

  useEffect(() => {
    if (!userAgent?.agent_id_from_agents) return;
    
    const loadAgent = async () => {
      setIsLoading(true);
      try {
        const details = await externalDb.getAgentDetails<AgentDetails>(userAgent.agent_id_from_agents!);
        if (details) {
          setAgent(details);
          const settingsStr = typeof details.settings === 'string'
            ? details.settings
            : JSON.stringify(details.settings, null, 2);
          methods.reset({
            config_json: settingsStr,
            system_prompt: details.prompt || '',
          });
        }
      } catch (error) {
        console.error('Error loading agent:', error);
        toast.error('Erro ao carregar dados do agente');
      } finally {
        setIsLoading(false);
      }
    };

    loadAgent();
  }, [userAgent?.agent_id_from_agents]);

  const handleSave = async () => {
    if (!user?.id || !codAgent) return;
    setIsSaving(true);

    try {
      const formData = methods.getValues();

      // Validate JSON if editing config
      if (canEditConfig) {
        try {
          JSON.parse(formData.config_json);
        } catch {
          toast.error('JSON de configurações inválido');
          setIsSaving(false);
          return;
        }
      }

      await externalDb.updateAgentByOwner(
        user.id,
        codAgent,
        canEditConfig ? formData.config_json : undefined,
        canEditPrompt ? formData.system_prompt : undefined
      );

      toast.success('Agente atualizado com sucesso!');
      navigate('/agente/meus-agentes');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!agent || !userAgent) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Agente não encontrado ou sem permissão</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/agente/meus-agentes')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  if (!canEditConfig && !canEditPrompt) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Você não tem permissão para editar este agente</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/agente/meus-agentes')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agente/meus-agentes')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Editar Agente
            </h1>
            <p className="text-muted-foreground">
              {agent.business_name || agent.client_name} — #{agent.cod_agent}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>

      {/* Form */}
      <FormProvider {...methods}>
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue={defaultTab}>
              <TabsList className="mb-6">
                {canEditConfig && (
                  <TabsTrigger value="config" className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Configurações
                  </TabsTrigger>
                )}
                {canEditPrompt && (
                  <TabsTrigger value="prompt" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Prompt
                  </TabsTrigger>
                )}
              </TabsList>

              {canEditConfig && (
                <TabsContent value="config">
                  <ConfigStep />
                </TabsContent>
              )}
              {canEditPrompt && (
                <TabsContent value="prompt">
                  <PromptStep />
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </FormProvider>
    </div>
  );
}
