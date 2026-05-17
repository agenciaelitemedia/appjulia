import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  orderId: string;
  checkoutUrl: string;
  onProvisioned: () => void;
}

export function CheckoutStep({ orderId, checkoutUrl, onProvisioned }: Props) {
  const [status, setStatus] = useState<'pending' | 'paid' | 'provisioned' | 'failed'>('pending');
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const apply = (row: any) => {
      if (cancelled || !row) return;
      if (row.status) setStatus(row.status);
      if (row.provisioning_error) setError(row.provisioning_error);
      if (row.status === 'provisioned') {
        const clientId = user?.client_id ? String(user.client_id) : null;
        if (clientId) qc.invalidateQueries({ queryKey: ['agent-queue-limits', clientId] });
        onProvisioned();
      }
    };

    (async () => {
      const { data } = await supabase
        .from('queue_orders' as never)
        .select('status, provisioning_error')
        .eq('id', orderId)
        .maybeSingle() as any;
      apply(data);
    })();

    const channel = supabase
      .channel(`queue-order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queue_orders', filter: `id=eq.${orderId}` },
        (payload) => apply(payload.new))
      .subscribe();

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('queue_orders' as never)
        .select('status, provisioning_error')
        .eq('id', orderId)
        .maybeSingle() as any;
      apply(data);
    }, 15000);

    return () => { cancelled = true; clearInterval(interval); supabase.removeChannel(channel); };
  }, [orderId, onProvisioned, qc, user?.client_id]);

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader><CardTitle>Pagamento</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {status === 'pending' && (
          <>
            <div className="text-sm text-muted-foreground">
              Você será redirecionado para o Mercado Pago. Após o pagamento, voltaremos para confirmar e liberar suas filas automaticamente.
            </div>
            <Button onClick={() => window.open(checkoutUrl, '_blank', 'noopener')} className="w-full">
              <ExternalLink className="h-4 w-4 mr-1" /> Abrir pagamento no Mercado Pago
            </Button>
            <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Aguardando confirmação do pagamento…
            </div>
          </>
        )}
        {status === 'paid' && (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <div className="font-semibold">Pagamento confirmado!</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Liberando suas filas…
            </div>
            {error && (
              <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 rounded mt-3">{error}</div>
            )}
          </div>
        )}
        {status === 'provisioned' && (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
            <div className="font-semibold">Plano de filas ativado!</div>
          </div>
        )}
        {status === 'failed' && (
          <div className="text-center py-6 space-y-2">
            <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto" />
            <div className="font-semibold">Pagamento não concluído</div>
            <div className="text-sm text-muted-foreground">Tente novamente ou entre em contato com o suporte.</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}