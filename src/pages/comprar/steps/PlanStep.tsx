import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, Star, Zap, Crown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { OrderData } from '../ComprarPage';

interface PlanFromDB {
  id: string;
  name: string;
  price: number;
  price_monthly: number;
  price_semiannual: number;
  price_annual: number;
  icon: string;
  color: string;
  features: string[];
  is_popular: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  zap: <Zap className="w-6 h-6" />,
  star: <Star className="w-6 h-6" />,
  crown: <Crown className="w-6 h-6" />,
};

type BillingPeriod = 'monthly' | 'semiannual' | 'annual';

const periodLabels: Record<BillingPeriod, { label: string; suffix: string }> = {
  monthly: { label: 'Mensal', suffix: '/mês' },
  semiannual: { label: 'Semestral', suffix: '/semestre' },
  annual: { label: 'Anual', suffix: '/ano' },
};

interface Props {
  orderData: OrderData;
  updateOrder: (data: Partial<OrderData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export const PlanStep = ({ orderData, updateOrder, onNext, onBack }: Props) => {
  const [plans, setPlans] = useState<PlanFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(-1);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(orderData.billing_period || 'monthly');

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from('julia_plans')
        .select('*')
        .eq('is_active', true)
        .order('position');

      if (data) {
        const mapped = data.map(p => ({
          ...p,
          features: (p.features as any) || [],
          price_monthly: p.price_monthly ?? 0,
          price_semiannual: p.price_semiannual ?? 0,
          price_annual: p.price_annual ?? 0,
        }));
        setPlans(mapped);
        if (orderData.plan_name) {
          const idx = mapped.findIndex(p => p.name === orderData.plan_name);
          if (idx >= 0) setSelected(idx);
        }
      }
      setLoading(false);
    };
    fetchPlans();
  }, [orderData.plan_name]);

  // Detect which periods have at least one plan with price > 0
  const availablePeriods = useMemo(() => {
    const periods: BillingPeriod[] = [];
    if (plans.some(p => p.price_monthly > 0)) periods.push('monthly');
    if (plans.some(p => p.price_semiannual > 0)) periods.push('semiannual');
    if (plans.some(p => p.price_annual > 0)) periods.push('annual');
    return periods;
  }, [plans]);

  // Auto-select first available period
  useEffect(() => {
    if (availablePeriods.length > 0 && !availablePeriods.includes(billingPeriod)) {
      setBillingPeriod(availablePeriods[0]);
    }
  }, [availablePeriods, billingPeriod]);

  const getPriceByPeriod = (plan: PlanFromDB): number => {
    if (billingPeriod === 'annual') return plan.price_annual;
    if (billingPeriod === 'semiannual') return plan.price_semiannual;
    return plan.price_monthly;
  };

  // Filter plans that have price > 0 for selected period
  const filteredPlans = useMemo(() => {
    return plans.filter(p => getPriceByPeriod(p) > 0);
  }, [plans, billingPeriod]);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const handleSelect = (planId: string) => {
    const idx = plans.findIndex(p => p.id === planId);
    setSelected(idx);
    const plan = plans[idx];
    updateOrder({
      plan_name: plan.name,
      plan_price: getPriceByPeriod(plan),
      billing_period: billingPeriod,
    });
  };

  const handlePeriodChange = (period: BillingPeriod) => {
    setBillingPeriod(period);
    // Reset selection if current plan has no price in new period
    if (selected >= 0) {
      const plan = plans[selected];
      const price = period === 'annual' ? plan.price_annual : period === 'semiannual' ? plan.price_semiannual : plan.price_monthly;
      if (price > 0) {
        updateOrder({ plan_price: price, billing_period: period });
      } else {
        setSelected(-1);
        updateOrder({ plan_name: '', plan_price: 0, billing_period: period });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#6C3AED]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#1a1a2e]">Escolha seu plano</h2>
        <p className="text-gray-500 mt-1">Selecione o plano ideal para o seu escritório</p>
      </div>

      {/* Period selector — only show if more than 1 period available */}
      {availablePeriods.length > 1 && (
        <div className="flex justify-center">
          <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
            {availablePeriods.map(period => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  billingPeriod === period
                    ? 'bg-[#6C3AED] text-white shadow-sm'
                    : 'text-gray-600 hover:text-[#6C3AED]'
                }`}
              >
                {periodLabels[period].label}
                {period === 'annual' && (
                  <span className={`ml-1 text-xs ${billingPeriod === period ? 'text-white/80' : 'text-green-600'}`}>
                    💰
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {filteredPlans.map((plan) => {
          const price = getPriceByPeriod(plan);
          const isSelected = selected >= 0 && plans[selected]?.id === plan.id;
          return (
            <div
              key={plan.id}
              onClick={() => handleSelect(plan.id)}
              className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 bg-white ${
                isSelected
                  ? 'border-[#6C3AED] shadow-lg shadow-[#6C3AED]/10 scale-[1.02]'
                  : 'border-gray-100 hover:border-[#6C3AED]/30 hover:shadow-md'
              }`}
            >
              {plan.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6C3AED] text-white text-xs font-bold px-3 py-1 rounded-full">
                  POPULAR
                </div>
              )}

              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center text-white mb-4`}>
                {iconMap[plan.icon] || <Zap className="w-6 h-6" />}
              </div>

              <h3 className="font-bold text-lg text-[#1a1a2e]">{plan.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-extrabold text-[#1a1a2e]">{formatPrice(price)}</span>
                <span className="text-gray-400 text-sm">{periodLabels[billingPeriod].suffix}</span>
              </div>

              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-[#6C3AED] mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#6C3AED] flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredPlans.length === 0 && (
        <p className="text-center text-gray-400 py-8">Nenhum plano disponível para este período.</p>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-12 rounded-xl border-gray-200">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={selected < 0}
          className="flex-1 h-12 bg-[#6C3AED] hover:bg-[#5B2BD4] text-white font-semibold rounded-xl"
        >
          Continuar <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
};
