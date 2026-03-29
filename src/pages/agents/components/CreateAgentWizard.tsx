import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Save, User, CreditCard, Settings, MessageSquare, UserCircle, Loader2 } from 'lucide-react';
import { ClientStep } from './wizard-steps/ClientStep';
import { PlanStep } from './wizard-steps/PlanStep';
import { ConfigStep } from './wizard-steps/ConfigStep';
import { PromptStep } from './wizard-steps/PromptStep';
import { UserStep } from './wizard-steps/UserStep';
import { useAgentSave } from '../hooks/useAgentSave';
import { useAgentCode } from '../hooks/useAgentCode';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

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
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  
  const { saveAgent, isSaving } = useAgentSave();
  const { generateCode } = useAgentCode();

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

  const [createdAgentId, setCreatedAgentId] = useState<number | null>(null);

  const onSubmit = async (data: AgentFormData) => {
    const result = await saveAgent(data, generateCode);
    
    if (result.success && result.agentId) {
      toast.success('Agente criado com sucesso!');
      setCreatedAgentId(result.agentId);
      
      // If new user was created, show password dialog first
      if (result.tempPassword) {
        setTempPassword(result.tempPassword);
        setShowPasswordDialog(true);
      } else {
        // Navigate directly to details page
        navigate(`/admin/agentes/${result.agentId}/detalhes`);
      }
    } else {
      toast.error(result.error || 'Erro ao criar agente');
      
      // Navigate to appropriate step based on error
      if (result.error?.includes('CPF/CNPJ')) {
        setCurrentStep(0); // Client step
      } else if (result.error?.includes('E-mail')) {
        setCurrentStep(4); // User step
      } else if (result.error?.includes('Código')) {
        setCurrentStep(0); // Client step (where code is shown)
      }
    }
  };

  const handleClosePasswordDialog = () => {
    setShowPasswordDialog(false);
    // Navigate to details page with tempPassword in state
    if (createdAgentId) {
      navigate(`/admin/agentes/${createdAgentId}/detalhes`, {
        state: { tempPassword }
      });
    } else {
      navigate('/admin/agentes');
    }
    setTempPassword(null);
    setCreatedAgentId(null);
  };

  const handleCopyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      toast.success('Senha copiada para a área de transferência');
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
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Agente
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

        {/* Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usuário Criado com Sucesso!</DialogTitle>
              <DialogDescription>
                Um novo usuário foi criado para operar este agente. Anote a senha temporária abaixo:
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <code className="text-lg font-mono font-semibold">{tempPassword}</code>
                <Button variant="outline" size="sm" onClick={handleCopyPassword}>
                  Copiar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Esta senha será salva no campo "remember_token" do usuário. 
                Recomendamos que o usuário altere a senha no primeiro acesso.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClosePasswordDialog}>
                Entendi, continuar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </form>
    </FormProvider>
  );
}
