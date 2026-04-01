import { useState } from 'react';
import { DocumentStep } from './steps/DocumentStep';
import { CustomerStep } from './steps/CustomerStep';
import { PlanStep } from './steps/PlanStep';
import { CheckoutStep } from './steps/CheckoutStep';
import { Check } from 'lucide-react';

export interface OrderData {
  id?: string;
  customer_document: string;
  customer_name: string;
  customer_email: string;
  customer_whatsapp: string;
  customer_address: string;
  plan_name: string;
  plan_price: number;
}

const steps = ['Documento', 'Dados', 'Plano', 'Pagamento'];

const ComprarPage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [orderData, setOrderData] = useState<OrderData>({
    customer_document: '',
    customer_name: '',
    customer_email: '',
    customer_whatsapp: '',
    customer_address: '',
    plan_name: '',
    plan_price: 0,
  });

  const updateOrder = (data: Partial<OrderData>) => {
    setOrderData(prev => ({ ...prev, ...data }));
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F7FF] via-white to-[#F0EAFF]">
      {/* Header */}
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

      {/* Stepper */}
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

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pb-12">
        {currentStep === 0 && (
          <DocumentStep orderData={orderData} updateOrder={updateOrder} onNext={nextStep} />
        )}
        {currentStep === 1 && (
          <CustomerStep orderData={orderData} updateOrder={updateOrder} onNext={nextStep} onBack={prevStep} />
        )}
        {currentStep === 2 && (
          <PlanStep orderData={orderData} updateOrder={updateOrder} onNext={nextStep} onBack={prevStep} />
        )}
        {currentStep === 3 && (
          <CheckoutStep orderData={orderData} onBack={prevStep} />
        )}
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-gray-400">
        © {new Date().getFullYear()} AtendeJulIA — Todos os direitos reservados
      </footer>
    </div>
  );
};

export default ComprarPage;
