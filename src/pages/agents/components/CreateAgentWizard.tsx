import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Save, User, CreditCard, Settings, MessageSquare, UserCircle } from 'lucide-react';
import { ClientStep } from './wizard-steps/ClientStep';
import { PlanStep } from './wizard-steps/PlanStep';
import { ConfigStep } from './wizard-steps/ConfigStep';
import { PromptStep } from './wizard-steps/PromptStep';
import { UserStep } from './wizard-steps/UserStep';
import { toast } from 'sonner';

export interface SelectedClient {
  id: number;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
}

export interface SelectedUser {
  id: number;
  name: string;
  email: string;
}

export interface AgentFormData {
  // Aba Cliente
  cod_agent: string;
  client_id: number | null;
  is_closer: boolean;
  selected_client: SelectedClient | null;
  
  // Campos novo cliente
  new_client: boolean;
  client_name: string;
  client_business_name: string;
  client_federal_id: string;
  client_email: string;
  client_phone: string;
  client_zip_code: string;
  client_street: string;
  client_street_number: string;
  client_complement: string;
  client_neighborhood: string;
  client_city: string;
  client_state: string;
  
  // Aba Planos
  plan_id: string;
  lead_limit: number;
  due_day: number;
  
  // Aba Configurações
  config_json: string;
  
  // Aba Prompt
  system_prompt: string;
  
  // Aba Usuário
  user_id: number | null;
  selected_user: SelectedUser | null;
  new_user: boolean;
  user_name: string;
  user_email: string;
}

const STEPS = [
  { id: 'cliente', label: 'Cliente', icon: User },
  { id: 'planos', label: 'Planos', icon: CreditCard },
  { id: 'config', label: 'Configurações', icon: Settings },
  { id: 'prompt', label: 'Prompt', icon: MessageSquare },
  { id: 'usuario', label: 'Usuário', icon: UserCircle },
];

export function CreateAgentWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<AgentFormData>({
    defaultValues: {
      cod_agent: '',
      client_id: null,
      is_closer: false,
      selected_client: null,
      new_client: false,
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
      due_day: new Date().getDate(),
      config_json: '{\n  \n}',
      system_prompt: '',
      user_id: null,
      selected_user: null,
      new_user: false,
      user_name: '',
      user_email: '',
    },
  });

  const handleNext = () => {
    console.log('handleNext called, currentStep:', currentStep, 'STEPS.length:', STEPS.length);
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
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

  const onSubmit = async (data: AgentFormData) => {
    setIsSubmitting(true);
    try {
      // TODO: Implement actual save logic
      console.log('Form data:', data);
      toast.success('Agente criado com sucesso!');
      navigate('/admin/agentes');
    } catch (error) {
      toast.error('Erro ao criar agente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLastStep = currentStep === STEPS.length - 1;

  return (
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
                  <ClientStep />
                </TabsContent>
                <TabsContent value="planos" className="mt-0">
                  <PlanStep />
                </TabsContent>
                <TabsContent value="config" className="mt-0">
                  <ConfigStep />
                </TabsContent>
                <TabsContent value="prompt" className="mt-0">
                  <PromptStep />
                </TabsContent>
                <TabsContent value="usuario" className="mt-0">
                  <UserStep />
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
                <Button type="submit" disabled={isSubmitting}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Salvando...' : 'Salvar Agente'}
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
  );
}
