import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { AgentFormData } from '../CreateAgentWizard';

const COUNTRY_CODES = [
  { code: '55', name: 'Brasil (+55)' },
  { code: '1', name: 'EUA (+1)' },
  { code: '351', name: 'Portugal (+351)' },
  { code: '34', name: 'Espanha (+34)' },
  { code: '54', name: 'Argentina (+54)' },
];

export function CRMStep() {
  const { control } = useFormContext<AgentFormData>();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Integrações CRM</h3>
        <p className="text-sm text-muted-foreground">
          Configure as integrações com o sistema Helena e WhatsApp
        </p>
      </div>

      {/* Helena Integration */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-foreground">Integração Helena</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Helena Count ID */}
          <FormField
            control={control}
            name="helena_count_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Helena Count ID</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Ex: 12345"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  ID de contagem no sistema Helena
                </FormDescription>
              </FormItem>
            )}
          />

          {/* Helena Token */}
          <FormField
            control={control}
            name="helena_token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Helena Token</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Token de autenticação"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Token de autenticação da API Helena
                </FormDescription>
              </FormItem>
            )}
          />
        </div>
      </div>

      <Separator />

      {/* WhatsApp Integration */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-foreground">Integração WhatsApp</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* País */}
          <FormField
            control={control}
            name="whatsapp_country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>País</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o país" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COUNTRY_CODES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Código do país para o número WhatsApp
                </FormDescription>
              </FormItem>
            )}
          />

          {/* Número WhatsApp */}
          <FormField
            control={control}
            name="whatsapp_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número WhatsApp</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="Ex: 11999998888"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Número completo sem o código do país
                </FormDescription>
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Integration status summary */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <h4 className="font-medium text-foreground mb-2">Status das Integrações</h4>
        <div className="text-sm text-muted-foreground space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span>Helena: Não configurado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span>WhatsApp: Não configurado</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          O status será atualizado após salvar o agente
        </p>
      </div>
    </div>
  );
}
