import { CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ComprarSucessoPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F7FF] via-white to-[#F0EAFF] flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-0 shadow-xl shadow-[#6C3AED]/5 bg-white/80 backdrop-blur">
        <CardContent className="pt-10 pb-8 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e]">Pagamento confirmado!</h1>
            <p className="text-gray-500 mt-2">
              Seu pedido foi processado com sucesso. Em breve você receberá um e-mail com os detalhes do seu plano.
            </p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#F8F7FF] to-[#F0EAFF] p-4">
            <p className="text-sm text-[#6C3AED] font-medium">
              Nossa equipe entrará em contato via WhatsApp para configurar sua conta.
            </p>
          </div>
          <Button
            onClick={() => window.location.href = 'https://atendejulia.com.br'}
            className="w-full h-12 bg-[#6C3AED] hover:bg-[#5B2BD4] text-white font-semibold rounded-xl"
          >
            Voltar ao site
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComprarSucessoPage;
