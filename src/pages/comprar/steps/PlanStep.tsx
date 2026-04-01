import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, Star, Zap, Crown } from 'lucide-react';
import type { OrderData } from '../ComprarPage';

interface PlanOption {
  name: string;
  price: number; // centavos
  priceDisplay: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
  color: string;
}

const plans: PlanOption[] = [
  {
    name: 'Plano Essencial',
    price: 29700,
    priceDisplay: 'R$ 297',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-blue-500 to-blue-600',
    features: [
      'Até 500 leads/mês',
      'Atendimento WhatsApp IA',
      'CRM básico incluso',
      'Suporte por e-mail',
    ],
  },
  {
    name: 'Plano Profissional',
    price: 49700,
    priceDisplay: 'R$ 497',
    icon: <Star className="w-6 h-6" />,
    color: 'from-[#6C3AED] to-[#7C3AED]',
    popular: true,
    features: [
      'Até 2.000 leads/mês',
      'Atendimento WhatsApp IA',
      'CRM completo + automações',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
  },
  {
    name: 'Plano Enterprise',
    price: 99700,
    priceDisplay: 'R$ 997',
    icon: <Crown className="w-6 h-6" />,
    color: 'from-amber-500 to-amber-600',
    features: [
      'Leads ilimitados',
      'Atendimento WhatsApp IA',
      'CRM completo + automações',
      'Multi-agentes',
      'API personalizada',
      'Gerente de conta dedicado',
    ],
  },
];

interface Props {
  orderData: OrderData;
  updateOrder: (data: Partial<OrderData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export const PlanStep = ({ orderData, updateOrder, onNext, onBack }: Props) => {
  const [selected, setSelected] = useState(
    orderData.plan_name ? plans.findIndex(p => p.name === orderData.plan_name) : -1
  );

  const handleSelect = (index: number) => {
    setSelected(index);
    const plan = plans[index];
    updateOrder({ plan_name: plan.name, plan_price: plan.price });
  };

  const handleNext = () => {
    if (selected < 0) return;
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#1a1a2e]">Escolha seu plano</h2>
        <p className="text-gray-500 mt-1">Selecione o plano ideal para o seu escritório</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan, i) => (
          <div
            key={plan.name}
            onClick={() => handleSelect(i)}
            className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 bg-white ${
              selected === i
                ? 'border-[#6C3AED] shadow-lg shadow-[#6C3AED]/10 scale-[1.02]'
                : 'border-gray-100 hover:border-[#6C3AED]/30 hover:shadow-md'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6C3AED] text-white text-xs font-bold px-3 py-1 rounded-full">
                POPULAR
              </div>
            )}

            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center text-white mb-4`}>
              {plan.icon}
            </div>

            <h3 className="font-bold text-lg text-[#1a1a2e]">{plan.name}</h3>
            <div className="mt-2 mb-4">
              <span className="text-3xl font-extrabold text-[#1a1a2e]">{plan.priceDisplay}</span>
              <span className="text-gray-400 text-sm">/mês</span>
            </div>

            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-[#6C3AED] mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {selected === i && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#6C3AED] flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-12 rounded-xl border-gray-200">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button
          onClick={handleNext}
          disabled={selected < 0}
          className="flex-1 h-12 bg-[#6C3AED] hover:bg-[#5B2BD4] text-white font-semibold rounded-xl"
        >
          Continuar <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
};
