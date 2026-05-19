import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Video, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectPlanStep } from './steps/SelectPlanStep';
import { ConfirmDataStep } from './steps/ConfirmDataStep';
import { CheckoutStep } from './steps/CheckoutStep';
import { calculateTotal, type ContractDraft } from './types';

const initialDraft: ContractDraft = {
  plan: null,
  billing_period: 'monthly',
  extra_minute_packs: 0,
  recording_enabled: false,
  transcription_enabled: false,
  customer_name: '',
  customer_document: '',
  customer_email: '',
  customer_whatsapp: '',
};

type Step = 'plan' | 'data' | 'checkout' | 'success';

export default function ContratarVideoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('plan');
  const [draft, setDraft] = useState<ContractDraft>(initialDraft);
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  async function handleCreateOrder() {
    if (!user?.id) { toast.error('Usuário não autenticado'); return; }
    if (!draft.plan) return;
    const clientId = user?.client_id ? Number(user.client_id) : null;
    if (!clientId || !Number.isFinite(clientId)) {
      toast.error('Não foi possível identificar o cliente vinculado. Contate o suporte.');
      return;
    }
    setBusy(true);
    try {
      const t = calculateTotal(draft);
      const toCents = (v: number) => Math.round(v * 100);
      const client_breakdown_cents = {
        plan: toCents(t.plan),
        setup: toCents(t.setup),
        recording: toCents(t.recording),
        transcription: toCents(t.transcription),
        extras: toCents(t.extras),
        total: toCents(t.total),
      };

      const { data, error } = await supabase.functions.invoke('video-order-create', {
        body: {
          client_id: clientId,
          plan_id: draft.plan.id,
          billing_period: draft.billing_period,
          extra_minute_packs: draft.extra_minute_packs,
          recording_enabled: draft.recording_enabled,
          transcription_enabled: draft.transcription_enabled,
          customer_name: draft.customer_name,
          customer_document: draft.customer_document,
          customer_email: draft.customer_email,
          customer_whatsapp: draft.customer_whatsapp,
          client_breakdown_cents,
          expected_total_cents: client_breakdown_cents.total,
        },
      });
      if (error || !data?.order_id) {
        throw new Error(error?.message || data?.error || 'Falha ao criar pedido');
      }
      const oid = data.order_id;
      setOrderId(oid);

      const validation = data?.price_validation;
      if (validation && validation.ok === false) {
        console.warn('[ContratarVideo] Divergência de preço', validation);
        toast.warning('Atenção: o valor exibido difere do valor cobrado. Confira o total no pagamento.');
      }

      const { data: ck, error: ckErr } = await supabase.functions.invoke('video-order-checkout', {
        body: { order_id: oid },
      });
      if (ckErr || !ck?.checkout_url) {
        throw new Error(ckErr?.message || ck?.error || 'Falha ao gerar pagamento');
      }
      setCheckoutUrl(ck.checkout_url);
      setStep('checkout');
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Video className="h-6 w-6" /> Contratar Videochamadas
        </h1>
        <p className="text-sm text-muted-foreground">
          Escolha um plano, confirme seus dados e libere sua sala em minutos.
        </p>
      </div>

      <Stepper step={step} />

      {step === 'plan' && (
        <SelectPlanStep draft={draft} onChange={setDraft} onNext={() => setStep('data')} />
      )}
      {step === 'data' && (
        <ConfirmDataStep
          draft={draft}
          onChange={setDraft}
          onNext={handleCreateOrder}
          onBack={() => setStep('plan')}
          busy={busy}
        />
      )}
      {step === 'checkout' && orderId && checkoutUrl && (
        <CheckoutStep orderId={orderId} checkoutUrl={checkoutUrl} onProvisioned={() => setStep('success')} />
      )}
      {step === 'success' && (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="text-center py-12 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold">Tudo pronto!</h2>
            <p className="text-muted-foreground">
              Seu plano de videochamadas está ativo. Você já pode iniciar salas com seus leads.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>Ir para painel</Button>
              <Button onClick={() => navigate('/video')}>Acessar videochamadas</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { key: 'plan', label: 'Plano' },
    { key: 'data', label: 'Dados' },
    { key: 'checkout', label: 'Pagamento' },
    { key: 'success', label: 'Pronto' },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            i < idx ? 'bg-primary text-primary-foreground' :
            i === idx ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
            'bg-muted text-muted-foreground'
          }`}>{i + 1}</div>
          <span className={`text-sm ${i === idx ? 'font-semibold' : 'text-muted-foreground'}`}>{s.label}</span>
          {i < steps.length - 1 && <div className={`w-8 h-px ${i < idx ? 'bg-primary' : 'bg-muted'}`} />}
        </div>
      ))}
    </div>
  );
}