import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CreditCard, Users, TrendingUp } from 'lucide-react';
import { usePlans } from '../../hooks/usePlans';
import type { EditAgentFormData } from './EditClientStep';

export function EditPlanStep() {
  const { control, watch, setValue } = useFormContext<EditAgentFormData>();
  const { plans, isLoading, error } = usePlans();
  
  const selectedPlanId = watch('plan_id');
  const leadLimit = watch('lead_limit');
  const leadsReceived = watch('leads_received');

  const selectedPlan = plans.find(p => String(p.id) === selectedPlanId);

  const handlePlanChange = (planId: string) => {
    setValue('plan_id', planId);
    const plan = plans.find(p => String(p.id) === planId);
    if (plan) {
      setValue('lead_limit', plan.leads_limit);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const usagePercentage = leadLimit > 0 ? Math.round((leadsReceived / leadLimit) * 100) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground">Configuração do Plano</h3>
          <p className="text-sm text-muted-foreground">Carregando planos...</p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground">Configuração do Plano</h3>
          <p className="text-sm text-muted-foreground">Selecione o plano e configure os limites</p>
        </div>
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Configuração do Plano</h3>
        <p className="text-sm text-muted-foreground">
          Altere o plano e configure os limites do agente
        </p>
      </div>

      {/* Current Usage Card */}
      <Card className="bg-accent/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Uso Atual do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Leads recebidos:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{leadsReceived}</span>
              <span className="text-muted-foreground">/ {leadLimit}</span>
              <Badge variant={usagePercentage >= 90 ? "destructive" : usagePercentage >= 70 ? "secondary" : "default"}>
                {usagePercentage}%
              </Badge>
            </div>
          </div>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${usagePercentage >= 90 ? 'bg-destructive' : usagePercentage >= 70 ? 'bg-secondary' : 'bg-primary'}`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* Plan Select */}
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
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={String(plan.id)}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{plan.name}</span>
                        <span className="text-muted-foreground">
                          {formatPrice(plan.price)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                O plano define os recursos e limites base do agente
              </FormDescription>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lead Limit */}
          <FormField
            control={control}
            name="lead_limit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Limite de Leads</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Ex: 500"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormDescription>
                  Limite mensal de leads para este agente
                </FormDescription>
              </FormItem>
            )}
          />

          {/* Due Day */}
          <FormField
            control={control}
            name="due_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia do Vencimento *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="1-31"
                    {...field}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= 1 && value <= 31) {
                        field.onChange(value);
                      } else if (e.target.value === '') {
                        field.onChange(1);
                      }
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

        {/* Plan Summary */}
        {selectedPlan && (
          <Card className="bg-accent/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Resumo do Plano
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Plano:</span>
                <span className="font-medium">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Limite base:
                </span>
                <span className="font-medium">{selectedPlan.leads_limit} leads/mês</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Valor:</span>
                <span className="font-medium text-primary">{formatPrice(selectedPlan.price)}</span>
              </div>
              {leadLimit !== selectedPlan.leads_limit && (
                <div className="pt-2 border-t mt-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Limite customizado:</span>
                    <span className="font-medium text-amber-600">{leadLimit} leads/mês</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
