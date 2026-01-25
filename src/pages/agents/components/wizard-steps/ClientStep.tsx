import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { maskCPFCNPJ, maskPhone } from '@/lib/inputMasks';
import type { AgentFormData } from '../CreateAgentWizard';

// Mock data for existing clients - replace with real data later
const MOCK_CLIENTS = [
  { id: 'new', name: '+ Criar novo cliente' },
  { id: '1', name: 'Escritório ABC' },
  { id: '2', name: 'Advocacia XYZ' },
  { id: '3', name: 'Consultoria Legal' },
];

export function ClientStep() {
  const { control, watch, setValue } = useFormContext<AgentFormData>();
  const selectedClient = watch('client_id');
  const isNewClient = selectedClient === 'new';

  const handleClientChange = (value: string) => {
    setValue('client_id', value);
    setValue('new_client', value === 'new');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Dados do Cliente</h3>
        <p className="text-sm text-muted-foreground">
          Informe o código do agente e selecione ou cadastre o cliente
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Código do Agente */}
        <FormField
          control={control}
          name="cod_agent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código do Agente *</FormLabel>
              <FormControl>
                <Input placeholder="Ex: AG001" {...field} />
              </FormControl>
              <FormDescription>
                Identificador único do agente
              </FormDescription>
            </FormItem>
          )}
        />

        {/* Cliente Select */}
        <FormField
          control={control}
          name="client_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cliente *</FormLabel>
              <Select onValueChange={handleClientChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MOCK_CLIENTS.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      </div>

      {/* É Closer Switch */}
      <FormField
        control={control}
        name="is_closer"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">É Closer?</FormLabel>
              <FormDescription>
                Define se o agente atua como closer de vendas
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* New Client Fields - Conditional */}
      {isNewClient && (
        <>
          <Separator />
          <div>
            <h4 className="text-md font-medium text-foreground mb-4">Dados do Novo Cliente</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nome */}
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

              {/* Razão Social */}
              <FormField
                control={control}
                name="client_business_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razão Social</FormLabel>
                    <FormControl>
                      <Input placeholder="Razão social (opcional)" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* CPF/CNPJ */}
              <FormField
                control={control}
                name="client_document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ *</FormLabel>
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

              {/* E-mail */}
              <FormField
                control={control}
                name="client_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Telefone */}
              <FormField
                control={control}
                name="client_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
