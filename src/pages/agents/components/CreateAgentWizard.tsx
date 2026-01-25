import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Save, User, CreditCard, Settings, MessageSquare, Phone } from 'lucide-react';
import { ClientStep } from './wizard-steps/ClientStep';
import { PlanStep } from './wizard-steps/PlanStep';
import { ConfigStep } from './wizard-steps/ConfigStep';
import { PromptStep } from './wizard-steps/PromptStep';
import { CRMStep } from './wizard-steps/CRMStep';
import { toast } from 'sonner';

export interface AgentFormData {
  // Step 1 - Cliente
  cod_agent: string;
  client_id: string;
  is_closer: boolean;
  // New client fields (conditional)
  new_client: boolean;
  client_name: string;
  client_business_name: string;
  client_document: string;
  client_email: string;
  client_phone: string;
  // Step 2 - Planos
  plan_id: string;
  lead_limit: number;
  due_day: number;
  // Step 3 - Configurações
  config_json: string;
  // Step 4 - Prompt
  system_prompt: string;
  // Step 5 - CRM
  helena_count_id: string;
  helena_token: string;
  whatsapp_country: string;
  whatsapp_number: string;
}

const STEPS = [
  { id: 'cliente', label: 'Cliente', icon: User },
  { id: 'planos', label: 'Planos', icon: CreditCard },
  { id: 'config', label: 'Configurações', icon: Settings },
  { id: 'prompt', label: 'Prompt', icon: MessageSquare },
  { id: 'crm', label: 'CRM', icon: Phone },
];

export function CreateAgentWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<AgentFormData>({
    defaultValues: {
      cod_agent: '',
      client_id: '',
      is_closer: false,
      new_client: false,
      client_name: '',
      client_business_name: '',
      client_document: '',
      client_email: '',
      client_phone: '',
      plan_id: '',
      lead_limit: 0,
      due_day: 1,
      config_json: '{\n  \n}',
      system_prompt: '',
      helena_count_id: '',
      helena_token: '',
      whatsapp_country: '55',
      whatsapp_number: '',
    },
  });

  const handleNext = () => {
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
                {STEPS.map((step, index) => {
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
                <TabsContent value="crm" className="mt-0">
                  <CRMStep />
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
