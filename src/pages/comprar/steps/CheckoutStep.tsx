import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CreditCard, QrCode, Lock, ShieldCheck, CheckCircle2, Copy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { OrderData } from '../ComprarPage';

interface Props {
  orderData: OrderData;
  onBack: () => void;
}

const cardBrands: Record<string, { name: string; gradient: string }> = {
  visa: { name: 'Visa', gradient: 'from-blue-700 to-blue-900' },
  mastercard: { name: 'Mastercard', gradient: 'from-red-600 to-orange-500' },
  elo: { name: 'Elo', gradient: 'from-yellow-500 to-yellow-700' },
  amex: { name: 'Amex', gradient: 'from-cyan-600 to-cyan-800' },
  hipercard: { name: 'Hipercard', gradient: 'from-red-700 to-red-900' },
  diners: { name: 'Diners', gradient: 'from-gray-600 to-gray-800' },
  unknown: { name: '', gradient: 'from-gray-700 to-gray-900' },
};

function detectBrand(num: string): string {
  const d = num.replace(/\D/g, '');
  if (/^4/.test(d)) return 'visa';
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return 'mastercard';
  if (/^(636368|438935|504175|451416|636297|5067|4576|4011|506699)/.test(d)) return 'elo';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^(606282|3841)/.test(d)) return 'hipercard';
  if (/^3(0[0-5]|[68])/.test(d)) return 'diners';
  return 'unknown';
}

function fmtCardNum(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function fmtExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length >= 3) return d.slice(0, 2) + '/' + d.slice(2);
  return d;
}

function fmtCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function fmtPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

type Stage = 'form' | 'processing' | 'success';

export const CheckoutStep = ({ orderData, onBack }: Props) => {
  const [method, setMethod] = useState<'card' | 'pix'>('card');
  const [stage, setStage] = useState<Stage>('form');
  const [error, setError] = useState('');
  const [nsu, setNsu] = useState('');
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  // card fields (visual only)
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardCpf, setCardCpf] = useState('');
  const [installments, setInstallments] = useState(1);
  const [flipped, setFlipped] = useState(false);

  // pix
  const [pixEmail, setPixEmail] = useState(orderData.customer_email || '');
  const pixCode = 'PIX_CODE_PLACEHOLDER_' + (orderData.id || 'DEMO');

  const brand = detectBrand(cardNumber);
  const brandInfo = cardBrands[brand];
  const masked = cardNumber || '•••• •••• •••• ••••';
  const price = orderData.plan_price;

  const installmentOptions = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const val = price / n;
    const label = n === 1 ? `1x de ${fmtPrice(price)} (sem juros)` : `${n}x de ${fmtPrice(Math.ceil(val))}`;
    return { value: n, label };
  });

  useEffect(() => {
    if (stage === 'processing') {
      const t = setInterval(() => setProgress(p => Math.min(p + 2, 95)), 120);
      return () => clearInterval(t);
    }
  }, [stage]);

  const handlePay = async () => {
    if (!orderData.id) { setError('Pedido não encontrado.'); return; }
    setError('');
    setStage('processing');
    setProgress(0);

    try {
      await supabase
        .from('julia_orders')
        .update({ plan_name: orderData.plan_name, plan_price: orderData.plan_price, updated_at: new Date().toISOString() })
        .eq('id', orderData.id);

      const { data, error: fnErr } = await supabase.functions.invoke('infinitypay-checkout', {
        body: { order_id: orderData.id },
      });

      if (fnErr) throw fnErr;

      if (data?.checkout_url) {
        setNsu(data.order_nsu || '');
        setProgress(100);
        setTimeout(() => {
          setStage('success');
          window.open(data.checkout_url, '_blank');
        }, 800);
      } else {
        throw new Error('Não foi possível gerar o link de pagamento.');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Erro ao processar pagamento');
      setStage('form');
    }
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Processing ──
  if (stage === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a]">
        <div className="text-center space-y-6 max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-[#00D26A] to-emerald-400 flex items-center justify-center animate-pulse">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Processando pagamento...</h2>
          <p className="text-gray-400">Aguarde enquanto confirmamos seu pagamento</p>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00D26A] to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">{progress}%</p>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (stage === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a]">
        <div className="text-center space-y-6 max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-[#00D26A] to-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Pagamento iniciado!</h2>
          <p className="text-gray-400">O link de pagamento foi aberto em uma nova aba. Conclua o pagamento por lá.</p>
          {nsu && (
            <div className="bg-gray-800/60 rounded-xl p-4 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">NSU</span>
                <span className="text-white font-mono text-xs">{nsu}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Plano</span>
                <span className="text-white">{orderData.plan_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total</span>
                <span className="text-[#00D26A] font-bold">{fmtPrice(price)}</span>
              </div>
            </div>
          )}
          <Button onClick={onBack} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-[#6C3AED] flex items-center justify-center">
            <span className="text-white font-bold text-sm">J</span>
          </div>
          <span className="text-lg font-semibold">
            Atende<span className="text-[#6C3AED]">JulIA</span>
          </span>
          <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
            <Lock className="w-3 h-3" /> Pagamento Seguro
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left — Payment form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Method tabs */}
            <div className="flex gap-3">
              <button
                onClick={() => setMethod('card')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-medium ${
                  method === 'card'
                    ? 'border-[#00D26A] bg-[#00D26A]/10 text-[#00D26A]'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <CreditCard className="w-5 h-5" /> Cartão de Crédito
              </button>
              <button
                onClick={() => setMethod('pix')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-medium ${
                  method === 'pix'
                    ? 'border-[#00D26A] bg-[#00D26A]/10 text-[#00D26A]'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <QrCode className="w-5 h-5" /> Pix
              </button>
            </div>

            {method === 'card' && (
              <>
                {/* Card preview */}
                <div className="perspective-1000">
                  <div
                    className={`relative w-full max-w-sm mx-auto h-48 rounded-2xl p-6 bg-gradient-to-br ${brandInfo.gradient} shadow-2xl transition-transform duration-500 ${flipped ? '[transform:rotateY(180deg)]' : ''}`}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {!flipped ? (
                      <div className="flex flex-col justify-between h-full" style={{ backfaceVisibility: 'hidden' }}>
                        <div className="flex justify-between items-start">
                          <div className="w-10 h-7 bg-yellow-300/80 rounded-md" />
                          <span className="text-white/80 font-bold text-sm">{brandInfo.name}</span>
                        </div>
                        <div className="text-xl font-mono tracking-[0.2em] text-white/90">{masked}</div>
                        <div className="flex justify-between text-xs text-white/70">
                          <div>
                            <div className="text-[10px] uppercase opacity-60">Titular</div>
                            <div className="font-medium">{cardName || 'SEU NOME'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase opacity-60">Validade</div>
                            <div className="font-medium">{cardExpiry || 'MM/AA'}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col justify-center h-full [transform:rotateY(180deg)]" style={{ backfaceVisibility: 'hidden' }}>
                        <div className="w-full h-10 bg-black/40 rounded mb-4" />
                        <div className="flex justify-end">
                          <div className="bg-white/20 rounded px-4 py-2 font-mono text-lg tracking-widest">
                            {cardCvv || '•••'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card form */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-300 text-sm">Número do Cartão</Label>
                    <Input
                      value={cardNumber}
                      onChange={e => setCardNumber(fmtCardNum(e.target.value))}
                      placeholder="0000 0000 0000 0000"
                      className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-600 focus:border-[#00D26A] focus:ring-[#00D26A]/20 h-12 rounded-xl font-mono tracking-wider"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Nome no Cartão</Label>
                    <Input
                      value={cardName}
                      onChange={e => setCardName(e.target.value.toUpperCase())}
                      placeholder="NOME COMO ESTÁ NO CARTÃO"
                      className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-600 focus:border-[#00D26A] focus:ring-[#00D26A]/20 h-12 rounded-xl uppercase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 text-sm">Validade</Label>
                      <Input
                        value={cardExpiry}
                        onChange={e => setCardExpiry(fmtExpiry(e.target.value))}
                        placeholder="MM/AA"
                        className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-600 focus:border-[#00D26A] focus:ring-[#00D26A]/20 h-12 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 text-sm">CVV</Label>
                      <Input
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        onFocus={() => setFlipped(true)}
                        onBlur={() => setFlipped(false)}
                        placeholder="•••"
                        className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-600 focus:border-[#00D26A] focus:ring-[#00D26A]/20 h-12 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">CPF do titular</Label>
                    <Input
                      value={cardCpf}
                      onChange={e => setCardCpf(fmtCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-600 focus:border-[#00D26A] focus:ring-[#00D26A]/20 h-12 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Parcelas</Label>
                    <select
                      value={installments}
                      onChange={e => setInstallments(Number(e.target.value))}
                      className="w-full h-12 rounded-xl bg-gray-800/50 border border-gray-700 text-white px-3 focus:border-[#00D26A] focus:outline-none"
                    >
                      {installmentOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {method === 'pix' && (
              <div className="space-y-6">
                <div className="bg-gray-800/40 rounded-2xl p-6 flex flex-col items-center gap-4">
                  <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center">
                    <QrCode className="w-32 h-32 text-gray-800" />
                  </div>
                  <p className="text-gray-400 text-sm text-center">Escaneie o QR Code com o app do seu banco</p>
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Código Pix Copia e Cola</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={pixCode}
                      readOnly
                      className="bg-gray-800/50 border-gray-700 text-white font-mono text-xs h-12 rounded-xl"
                    />
                    <Button
                      onClick={handleCopyPix}
                      className={`h-12 rounded-xl px-4 ${copied ? 'bg-[#00D26A] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                      {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">E-mail para recibo</Label>
                  <Input
                    value={pixEmail}
                    onChange={e => setPixEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-600 focus:border-[#00D26A] focus:ring-[#00D26A]/20 h-12 rounded-xl"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-900/30 border border-red-800 text-red-400 text-sm">{error}</div>
            )}

            <Button
              onClick={handlePay}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-[#00D26A] to-emerald-500 hover:from-[#00C060] hover:to-emerald-400 text-white text-lg font-bold shadow-lg shadow-[#00D26A]/20"
            >
              {method === 'card' ? <CreditCard className="w-5 h-5 mr-2" /> : <QrCode className="w-5 h-5 mr-2" />}
              Pagar {fmtPrice(price)}
            </Button>
          </div>

          {/* Right — Summary sidebar */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800/40 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">Resumo do Pedido</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Plano</span>
                  <span className="text-white font-medium">{orderData.plan_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Cliente</span>
                  <span className="text-white">{orderData.customer_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">E-mail</span>
                  <span className="text-white text-xs">{orderData.customer_email}</span>
                </div>
                <hr className="border-gray-700" />
                <div className="flex justify-between items-center">
                  <span className="text-white font-bold">Total</span>
                  <span className="text-2xl font-extrabold text-[#00D26A]">
                    {fmtPrice(price)}
                    <span className="text-xs font-normal text-gray-500">/mês</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="bg-gray-800/40 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#00D26A]/10 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-[#00D26A]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">SSL Seguro</p>
                  <p className="text-xs text-gray-500">Criptografia de ponta a ponta</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#00D26A]/10 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-[#00D26A]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Anti-fraude</p>
                  <p className="text-xs text-gray-500">Proteção avançada</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#00D26A]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-[#00D26A]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Recebimento</p>
                  <p className="text-xs text-gray-500">Acesso imediato após confirmação</p>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-gray-600">
              Pagamento processado via InfinityPay
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
