import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DocumentStep } from './steps/DocumentStep';
import { CustomerStep } from './steps/CustomerStep';
import { PlanStep } from './steps/PlanStep';
import { ContractStep } from './steps/ContractStep';
import { CheckoutStep } from './steps/CheckoutStep';
import { generateContractBody } from './steps/ContractStep';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OrderData {
  id?: string;
  customer_document: string;
  customer_name: string;
  customer_email: string;
  customer_whatsapp: string;
  customer_address: string;
  plan_name: string;
  plan_price: number;
  billing_period: 'monthly' | 'semiannual' | 'annual';
  checkout_url?: string;
  payment_gateway: 'mercadopago' | 'infinitypay';
  contract_body?: string;
}

const NORMAL_STEPS = ['Documento', 'Dados', 'Plano', 'Contrato', 'Pagamento'];
const EXPRESS_STEPS = ['Documento', 'Dados', 'Pagamento'];

const ComprarPage = () => {
  const [searchParams] = useSearchParams();
  const paymentParam = searchParams.get('p');
  const paymentGateway: 'mercadopago' | 'infinitypay' = paymentParam === 'mp' ? 'mercadopago' : 'infinitypay';
  const isExpress = searchParams.get('t') === 'express';
  const channelParam = searchParams.get('c')?.toLowerCase() || '';

  const steps = isExpress ? EXPRESS_STEPS : NORMAL_STEPS;

  const [currentStep, setCurrentStep] = useState(0);
  const [expressPreparing, setExpressPreparing] = useState(false);
  const [orderData, setOrderData] = useState<OrderData>({
    customer_document: '',
    customer_name: '',
    customer_email: '',
    customer_whatsapp: '',
    customer_address: '',
    plan_name: '',
    plan_price: 0,
    billing_period: 'monthly',
    payment_gateway: paymentGateway,
  });

  const updateOrder = (data: Partial<OrderData>) => {
    setOrderData(prev => ({ ...prev, ...data }));
  };

  const goToStep = (step: number) => setCurrentStep(step);
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  // Express mode: auto-select plan + generate contract before going to payment
  const prepareExpressAndAdvance = useCallback(async () => {
    setExpressPreparing(true);
    try {
      // Fetch plans
      const { data: plans } = await supabase
        .from('julia_plans')
        .select('*')
        .eq('is_active', true)
        .order('position');

      if (!plans || plans.length === 0) {
        toast.error('Nenhum plano disponível.');
        setExpressPreparing(false);
        return;
      }

      // Filter by channel (same logic as PlanStep)
      let filtered = plans;
      if (channelParam === 'vendedora') filtered = plans.filter(p => p.price === 1200000);
      else if (channelParam === 'atendente') filtered = plans.filter(p => p.price === 300000);

      if (filtered.length === 0) {
        toast.error('Nenhum plano disponível para este canal.');
        setExpressPreparing(false);
        return;
      }

      const plan = filtered[0];
      const planPrice = plan.price_monthly || plan.price_semiannual || plan.price_annual || plan.price;
      const billingPeriod = plan.price_monthly > 0 ? 'monthly' : plan.price_semiannual > 0 ? 'semiannual' : 'annual';

      const updatedOrder: Partial<OrderData> = {
        plan_name: plan.name,
        plan_price: planPrice,
        billing_period: billingPeriod as OrderData['billing_period'],
      };

      // Generate contract in background
      const tempOrder = { ...orderData, ...updatedOrder };
      const contractBody = await generateContractBody(tempOrder as OrderData);

      setOrderData(prev => ({
        ...prev,
        ...updatedOrder,
        contract_body: contractBody,
      }));

      // Advance to payment (step 2 in express)
      setCurrentStep(2);
    } catch (err) {
      console.error('Express prepare error:', err);
      toast.error('Erro ao preparar pedido express.');
    } finally {
      setExpressPreparing(false);
    }
  }, [orderData, channelParam]);

  const nextStep = () => {
    if (isExpress && currentStep === 1) {
      // After CustomerStep in express mode, prepare and skip to payment
      prepareExpressAndAdvance();
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  // Map current step index to the right component
  const getStepComponent = () => {
    const stepLabel = steps[currentStep];

    if (expressPreparing) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#6C3AED]" />
          <p className="text-gray-500 text-sm">Preparando seu pedido...</p>
        </div>
      );
    }

    switch (stepLabel) {
      case 'Documento':
        return <DocumentStep orderData={orderData} updateOrder={updateOrder} onNext={nextStep} goToStep={goToStep} />;
      case 'Dados':
        return <CustomerStep orderData={orderData} updateOrder={updateOrder} onNext={nextStep} onBack={prevStep} />;
      case 'Plano':
        return <PlanStep orderData={orderData} updateOrder={updateOrder} onNext={nextStep} onBack={prevStep} />;
      case 'Contrato':
        return <ContractStep orderData={orderData} updateOrder={updateOrder} onNext={nextStep} onBack={prevStep} />;
      case 'Pagamento':
        return <CheckoutStep orderData={orderData} onBack={prevStep} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F7FF] via-white to-[#F0EAFF]">
      <header className="w-full py-6 px-4 flex justify-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6C3AED] flex items-center justify-center">
            <span className="text-white font-bold text-lg">J</span>
          </div>
          <span className="text-2xl font-bold text-[#1a1a2e]">
            Atende<span className="text-[#6C3AED]">JulIA</span>
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 mb-8">
        <div className="flex items-center justify-between">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    i < currentStep
                      ? 'bg-[#6C3AED] text-white'
                      : i === currentStep
                        ? 'bg-[#6C3AED] text-white ring-4 ring-[#6C3AED]/20'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < currentStep ? <Check className="w-5 h-5" /> : i + 1}
                </div>
                <span className={`text-xs mt-2 font-medium ${i <= currentStep ? 'text-[#6C3AED]' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 mt-[-1rem] ${i < currentStep ? 'bg-[#6C3AED]' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-12">
        {getStepComponent()}
      </div>

      <footer className="text-center py-6 text-sm text-gray-400 space-y-1">
        <p>ATENDE JULIA INOVA SIMPLES (I.S.) • CNPJ: 63.093.010/0001-39</p>
        <p>© {new Date().getFullYear()} AtendeJulIA — Todos os direitos reservados</p>
      </footer>
    </div>
  );
};

export default ComprarPage;
