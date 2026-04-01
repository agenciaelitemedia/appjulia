import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CreditCard, Loader2, ShieldCheck, ExternalLink, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { OrderData } from '../ComprarPage';

interface Props {
  orderData: OrderData;
  onBack: () => void;
}

export const CheckoutStep = ({ orderData, onBack }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  // Poll for payment confirmation
  useEffect(() => {
    if (!checkoutUrl || !orderData.id) return;

    pollingRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('julia_orders')
        .select('status')
        .eq('id', orderData.id!)
        .single();

      if (data?.status === 'paid') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        navigate('/comprar/sucesso');
      }
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [checkoutUrl, orderData.id, navigate]);

  const handleCheckPayment = async () => {
    if (!orderData.id) return;
    setChecking(true);
    try {
      const { data } = await supabase
        .from('julia_orders')
        .select('status')
        .eq('id', orderData.id)
        .single();

      if (data?.status === 'paid') {
        navigate('/comprar/sucesso');
      } else {
        setError('Pagamento ainda não confirmado. Aguarde alguns instantes e tente novamente.');
        setTimeout(() => setError(''), 4000);
      }
    } finally {
      setChecking(false);
    }
  };

  const handlePay = async () => {
    if (!orderData.id) {
      setError('Pedido não encontrado. Volte e preencha novamente.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await supabase
        .from('julia_orders')
        .update({
          plan_name: orderData.plan_name,
          plan_price: orderData.plan_price,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderData.id);

      const { data, error: fnError } = await supabase.functions.invoke('infinitypay-checkout', {
        body: { order_id: orderData.id },
      });

      if (fnError) throw fnError;

      if (data?.checkout_url) {
        setCheckoutUrl(data.checkout_url);
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

  if (checkoutUrl) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => { setCheckoutUrl(''); if (pollingRef.current) clearInterval(pollingRef.current); }} className="h-10 rounded-xl border-gray-200">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao resumo
          </Button>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleCheckPayment}
              disabled={checking}
              className="h-10 rounded-xl border-green-300 text-green-700 hover:bg-green-50"
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Já paguei
            </Button>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#6C3AED] hover:underline flex items-center gap-1"
            >
              Abrir em nova aba <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-amber-50 text-amber-700 text-sm text-center">{error}</div>
        )}

        <div className="rounded-2xl overflow-hidden border border-[#6C3AED]/20 shadow-xl shadow-[#6C3AED]/10 bg-white">
          <iframe
            src={checkoutUrl}
            className="w-full border-0"
            style={{ height: '680px' }}
            title="Pagamento InfinityPay"
            allow="payment"
          />
        </div>
        <div className="flex items-center gap-2 justify-center text-gray-400 text-xs">
          <ShieldCheck className="w-4 h-4" />
          Pagamento seguro via InfinityPay • Verificação automática ativa
        </div>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-xl shadow-[#6C3AED]/5 bg-white/80 backdrop-blur">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl text-[#1a1a2e]">Resumo do pedido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
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
