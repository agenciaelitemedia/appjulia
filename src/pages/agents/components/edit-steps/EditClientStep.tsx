import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import { maskCPFCNPJ, maskPhone, maskCEP, unmask } from '@/lib/inputMasks';
import { toast } from 'sonner';

export interface EditAgentFormData {
  // Agent data (readonly)
  cod_agent: string;
  // Agent data (editable)
  status: boolean;
  is_closer: boolean;
  
  // Client data (editable)
  client_id: number;
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
  
  // Plan data
  plan_id: string;
  lead_limit: number;
  due_day: number;
  
  // Config data
  config_json: string;
  
  // Prompt data
  system_prompt: string;
  
  // User data (readonly)
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  remember_token: string | null;
  leads_received: number;
}

export function EditClientStep() {
  const { control, setValue } = useFormContext<EditAgentFormData>();
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  const handleCepBlur = async (cep: string) => {
    const cleanCep = unmask(cep);
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      setValue('client_street', data.logradouro || '');
      setValue('client_neighborhood', data.bairro || '');
      setValue('client_city', data.localidade || '');
      setValue('client_state', data.uf || '');
    } catch (error) {
      console.error('Error fetching CEP:', error);
      toast.error('Erro ao buscar CEP');
    } finally {
      setIsLoadingCep(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Dados do Cliente e Agente</h3>
        <p className="text-sm text-muted-foreground">
          Edite as informações do cliente vinculado a este agente
        </p>
      </div>

      {/* Agent Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FormField
          control={control}
          name="cod_agent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código do Agente</FormLabel>
              <FormControl>
                <Input {...field} readOnly className="bg-muted" />
              </FormControl>
              <FormDescription>Não pode ser alterado</FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="status"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Status</FormLabel>
                <FormDescription>Ativar/Desativar agente</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="is_closer"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">É Closer?</FormLabel>
                <FormDescription>Atua como closer</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <Separator />

      {/* Client Data */}
      <div>
        <h4 className="text-base font-medium text-foreground mb-4">Dados do Cliente</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={control}
            name="client_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do cliente" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="client_business_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Escritório</FormLabel>
                <FormControl>
                  <Input placeholder="Razão social (opcional)" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="client_federal_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF/CNPJ</FormLabel>
                <FormControl>
                  <Input
                    placeholder="000.000.000-00"
                    {...field}
                    onChange={(e) => field.onChange(maskCPFCNPJ(e.target.value))}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="client_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@exemplo.com" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="client_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input
                    placeholder="(00) 00000-0000"
                    {...field}
                    onChange={(e) => field.onChange(maskPhone(e.target.value))}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="client_zip_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder="00000-000"
                      {...field}
                      onChange={(e) => field.onChange(maskCEP(e.target.value))}
                      onBlur={(e) => {
                        field.onBlur();
                        handleCepBlur(e.target.value);
                      }}
                    />
                    {isLoadingCep && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                    )}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="client_street"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Logradouro</FormLabel>
                <FormControl>
                  <Input placeholder="Rua, Avenida, etc." {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="client_street_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número</FormLabel>
                <FormControl>
                  <Input placeholder="123" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="client_complement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Complemento</FormLabel>
                <FormControl>
                  <Input placeholder="Sala, Apto, etc." {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="client_neighborhood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bairro</FormLabel>
                <FormControl>
                  <Input placeholder="Bairro" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="client_city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <Input placeholder="Cidade" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="client_state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <FormControl>
                  <Input placeholder="UF" maxLength={2} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
