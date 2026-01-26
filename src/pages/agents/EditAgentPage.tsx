import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Save, User, CreditCard, Settings, MessageSquare, UserCircle, Loader2, ArrowLeft } from 'lucide-react';
import { EditClientStep } from './components/edit-steps/EditClientStep';
import { EditPlanStep } from './components/edit-steps/EditPlanStep';
import { ConfigStep } from './components/wizard-steps/ConfigStep';
import { PromptStep } from './components/wizard-steps/PromptStep';
import { EditUserStep } from './components/edit-steps/EditUserStep';
import { useAgentUpdate } from './hooks/useAgentUpdate';
import { externalDb } from '@/lib/externalDb';
import { maskCPFCNPJ, maskPhone, maskCEP } from '@/lib/inputMasks';
import { toast } from 'sonner';
import type { EditAgentFormData } from './components/edit-steps/EditClientStep';

interface AgentDetails {
  id: number;
  cod_agent: string;
  status: boolean;
  is_closer: boolean;
  settings: string;
  prompt: string;
  due_date: number;
  created_at: string;
  client_id: number;
  client_name: string;
  business_name: string | null;
  federal_id: string | null;
  client_email: string | null;
  client_phone: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  plan_id: number | null;
  plan_name: string | null;
  plan_limit: number;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  remember_token: string | null;
  leads_received: number;
}

const STEPS = [
  { id: 'cliente', label: 'Cliente', icon: User },
  { id: 'planos', label: 'Planos', icon: CreditCard },
  { id: 'config', label: 'Configurações', icon: Settings },
  { id: 'prompt', label: 'Prompt', icon: MessageSquare },
  { id: 'usuario', label: 'Usuário', icon: UserCircle },
];

export default function EditAgentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [details, setDetails] = useState<AgentDetails | null>(null);
  
  const { saveChanges, isSaving } = useAgentUpdate();

  const methods = useForm<EditAgentFormData>({
    defaultValues: {
      cod_agent: '',
      status: true,
      is_closer: false,
      client_id: 0,
      client_name: '',
      client_business_name: '',
      client_federal_id: '',
      client_email: '',
      client_phone: '',
      client_zip_code: '',
      client_street: '',
      client_street_number: '',
      client_complement: '',
      client_neighborhood: '',
      client_city: '',
      client_state: '',
      plan_id: '',
      lead_limit: 0,
      due_day: 1,
      config_json: '{}',
      system_prompt: '',
      user_id: null,
      user_name: null,
      user_email: null,
      remember_token: null,
      leads_received: 0,
    },
  });

  // Load agent details
  useEffect(() => {
    async function loadAgent() {
      if (!id) return;
      
      setIsLoading(true);
      try {
        const data = await externalDb.getAgentDetails<AgentDetails>(parseInt(id));
        
        if (!data) {
          toast.error('Agente não encontrado');
          navigate('/admin/agentes');
          return;
        }
        
        setDetails(data);
        
        // Populate form with agent data
        methods.reset({
          cod_agent: data.cod_agent,
          status: data.status,
          is_closer: data.is_closer,
          client_id: data.client_id,
          client_name: data.client_name || '',
          client_business_name: data.business_name || '',
          client_federal_id: data.federal_id ? maskCPFCNPJ(data.federal_id) : '',
          client_email: data.client_email || '',
          client_phone: data.client_phone ? maskPhone(data.client_phone) : '',
          client_zip_code: data.zip_code ? maskCEP(data.zip_code) : '',
          client_street: data.street || '',
          client_street_number: data.street_number || '',
          client_complement: data.complement || '',
          client_neighborhood: data.neighborhood || '',
          client_city: data.city || '',
          client_state: data.state || '',
          plan_id: data.plan_id ? String(data.plan_id) : '',
          lead_limit: data.plan_limit || 0,
          due_day: data.due_date || 1,
          config_json: data.settings || '{}',
          system_prompt: data.prompt || '',
          user_id: data.user_id,
          user_name: data.user_name,
          user_email: data.user_email,
          remember_token: data.remember_token,
          leads_received: typeof data.leads_received === 'number' ? data.leads_received : parseInt(String(data.leads_received)) || 0,
        });
        
      } catch (error) {
        console.error('Error loading agent:', error);
        toast.error('Erro ao carregar dados do agente');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAgent();
  }, [id, navigate, methods]);

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleTabChange = (value: string) => {
    const index = STEPS.findIndex(step => step.id === value);
    if (index !== -1) {
      setCurrentStep(index);
    }
  };

  const onSubmit = async (data: EditAgentFormData) => {
    if (!details) return;
    
    const result = await saveChanges(details.id, details.client_id, {
      status: data.status,
      is_closer: data.is_closer,
      config_json: data.config_json,
      system_prompt: data.system_prompt,
      plan_id: data.plan_id,
      lead_limit: data.lead_limit,
      due_day: data.due_day,
      client_name: data.client_name,
      client_business_name: data.client_business_name,
      client_federal_id: data.client_federal_id,
      client_email: data.client_email,
      client_phone: data.client_phone,
      client_zip_code: data.client_zip_code,
      client_street: data.client_street,
      client_street_number: data.client_street_number,
      client_complement: data.client_complement,
      client_neighborhood: data.client_neighborhood,
      client_city: data.client_city,
      client_state: data.client_state,
    });
    
    if (result.success) {
      toast.success('Agente atualizado com sucesso!');
      navigate(`/admin/agentes/${id}/detalhes`);
    } else {
      toast.error(result.error || 'Erro ao atualizar agente');
    }
  };
  
  const isLastStep = currentStep === STEPS.length - 1;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-10 w-full mb-6" />
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/admin/agentes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Editar Agente</h1>
            <p className="text-sm text-muted-foreground">
              Código: {details?.cod_agent}
            </p>
          </div>
        </div>
        <Button onClick={methods.handleSubmit(onSubmit)} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>

      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <Card>
            <CardContent className="p-6">
              <Tabs value={STEPS[currentStep].id} onValueChange={handleTabChange}>
                <TabsList className="grid w-full grid-cols-5 mb-6">
                  {STEPS.map((step) => {
                    const Icon = step.icon;
                    return (
                      <TabsTrigger
                        key={step.id}
                        value={step.id}
                        className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{step.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <div className="min-h-[400px]">
                  <TabsContent value="cliente" className="mt-0">
                    <EditClientStep />
                  </TabsContent>
                  <TabsContent value="planos" className="mt-0">
                    <EditPlanStep />
                  </TabsContent>
                  <TabsContent value="config" className="mt-0">
                    <ConfigStep />
                  </TabsContent>
                  <TabsContent value="prompt" className="mt-0">
                    <PromptStep />
                  </TabsContent>
                  <TabsContent value="usuario" className="mt-0">
                    <EditUserStep />
                  </TabsContent>
                </div>
              </Tabs>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-6 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>

                {isLastStep ? (
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                ) : (
                  <Button type="button" onClick={handleNext}>
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </form>
      </FormProvider>
    </div>
  );
}
