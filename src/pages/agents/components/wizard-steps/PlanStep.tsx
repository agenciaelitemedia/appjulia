import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AgentFormData } from '../CreateAgentWizard';

// Mock data for plans - replace with real data later
const MOCK_PLANS = [
  { id: '1', name: 'Básico', leads: 100 },
  { id: '2', name: 'Profissional', leads: 500 },
  { id: '3', name: 'Enterprise', leads: 2000 },
  { id: '4', name: 'Ilimitado', leads: -1 },
];

export function PlanStep() {
  const { control, watch, setValue } = useFormContext<AgentFormData>();
  const selectedPlan = watch('plan_id');

  const handlePlanChange = (value: string) => {
    setValue('plan_id', value);
    // Auto-fill lead limit based on selected plan
    const plan = MOCK_PLANS.find(p => p.id === value);
    if (plan && plan.leads > 0) {
      setValue('lead_limit', plan.leads);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Configuração do Plano</h3>
        <p className="text-sm text-muted-foreground">
          Selecione o plano e configure os limites do agente
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plano */}
        <FormField
          control={control}
          name="plan_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plano *</FormLabel>
              <Select onValueChange={handlePlanChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MOCK_PLANS.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} {plan.leads > 0 ? `(${plan.leads} leads)` : '(Ilimitado)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Define os recursos e limites disponíveis
              </FormDescription>
            </FormItem>
          )}
        />

        {/* Limite de Leads */}
        <FormField
          control={control}
          name="lead_limit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Limite de Leads</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormDescription>
                Override do limite padrão do plano (0 = usar padrão)
              </FormDescription>
            </FormItem>
          )}
        />

        {/* Dia do Vencimento */}
        <FormField
          control={control}
          name="due_day"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dia do Vencimento *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="1"
                  min={1}
                  max={31}
                  {...field}
                  onChange={(e) => {
                    let value = parseInt(e.target.value) || 1;
                    if (value < 1) value = 1;
                    if (value > 31) value = 31;
                    field.onChange(value);
                  }}
                />
              </FormControl>
              <FormDescription>
                Dia do mês para renovação (1-31)
              </FormDescription>
            </FormItem>
          )}
        />
      </div>

      {/* Plan summary card */}
      {selectedPlan && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="font-medium text-foreground mb-2">Resumo do Plano</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <span className="font-medium">Plano selecionado:</span>{' '}
              {MOCK_PLANS.find(p => p.id === selectedPlan)?.name}
            </p>
            <p>
              <span className="font-medium">Limite base:</span>{' '}
              {(() => {
                const plan = MOCK_PLANS.find(p => p.id === selectedPlan);
                return plan?.leads === -1 ? 'Ilimitado' : `${plan?.leads} leads/mês`;
              })()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
