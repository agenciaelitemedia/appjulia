import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { OrderData } from '../ComprarPage';

interface Props {
  orderData: OrderData;
  onBack: () => void;
}

export const CheckoutStep = ({ orderData, onBack }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const handlePay = async () => {
    if (!orderData.id) {
      setError('Pedido não encontrado. Volte e preencha novamente.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Update the draft with plan info
      await supabase
        .from('julia_orders')
        .update({
          plan_name: orderData.plan_name,
          plan_price: orderData.plan_price,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderData.id);

      // Call checkout edge function
      const { data, error: fnError } = await supabase.functions.invoke('infinitypay-checkout', {
        body: { order_id: orderData.id },
      });

      if (fnError) throw fnError;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError('Não foi possível gerar o link de pagamento. Tente novamente.');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Erro ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-xl shadow-[#6C3AED]/5 bg-white/80 backdrop-blur">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl text-[#1a1a2e]">Resumo do pedido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        {/* Order summary */}
        <div className="rounded-xl bg-gradient-to-br from-[#F8F7FF] to-[#F0EAFF] p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Plano</span>
            <span className="font-semibold text-[#1a1a2e]">{orderData.plan_name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Cliente</span>
            <span className="font-medium text-[#1a1a2e]">{orderData.customer_name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">E-mail</span>
            <span className="text-sm text-[#1a1a2e]">{orderData.customer_email}</span>
          </div>
          <hr className="border-[#6C3AED]/10" />
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-[#1a1a2e]">Total</span>
            <span className="text-2xl font-extrabold text-[#6C3AED]">
              {formatPrice(orderData.plan_price)}
              <span className="text-sm font-normal text-gray-400">/mês</span>
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        {/* Security badge */}
        <div className="flex items-center gap-2 justify-center text-gray-400 text-xs">
          <ShieldCheck className="w-4 h-4" />
          Pagamento seguro via InfinityPay
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="h-12 rounded-xl border-gray-200">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button
            onClick={handlePay}
            disabled={loading}
            className="flex-1 h-14 bg-[#6C3AED] hover:bg-[#5B2BD4] text-white text-lg font-bold rounded-xl"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Pagar agora
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
