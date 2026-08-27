import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface JuliaOrder {
  id: string;
  customer_name: string;
  customer_document: string;
  customer_address: string;
  customer_email: string;
  customer_whatsapp: string;
  plan_name: string;
  plan_price: number;
  billing_period: string;
  status: string;
  order_nsu: string | null;
  checkout_url: string | null;
  infinitypay_transaction_nsu: string | null;
  receipt_url: string | null;
  paid_amount: number | null;
  installments: number | null;
  webhook_payload: any;
  cod_agent: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  payment_gateway: string;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  net_amount: number | null;
  fee_amount: number | null;
  contract_body: string | null;
}

export function useOrders() {
  const [orders, setOrders] = useState<JuliaOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('julia_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setOrders((data as JuliaOrder[]) || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const paidOrders = orders.filter(o => o.status === 'paid');

  const stats = {
    total: orders.length,
    paid: paidOrders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    draft: orders.filter(o => o.status === 'draft').length,
    totalRevenue: paidOrders.reduce((sum, o) => sum + (o.paid_amount || o.plan_price), 0),
    totalFees: paidOrders.reduce((sum, o) => sum + (o.fee_amount || 0), 0),
    totalNetRevenue: paidOrders.reduce((sum, o) => {
      if (o.net_amount != null) return sum + o.net_amount;
      // Fallback: paid_amount - fee_amount
      const paid = o.paid_amount || o.plan_price;
      return sum + paid - (o.fee_amount || 0);
    }, 0),
  };

  return { orders, isLoading, error, refetch: fetchOrders, stats };
}

export async function updateOrderNetAmount(orderId: string, netAmountCents: number) {
  const { error } = await supabase
    .from('julia_orders')
    .update({ net_amount: netAmountCents, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw error;
}

export async function deleteOrder(orderId: string) {
  const { error } = await supabase.from('julia_orders').delete().eq('id', orderId);
  if (error) throw error;
}

export interface ManualPaymentInput {
  paidAmountCents: number;
  feeAmountCents: number;
  paidAt: string; // ISO
  notes?: string;
}

/** Baixa manual: marca o pedido como pago informando valores e data. */
export async function markOrderPaidManually(order: JuliaOrder, input: ManualPaymentInput) {
  const net = Math.max(0, input.paidAmountCents - (input.feeAmountCents || 0));
  const noteLine = `[Baixa manual em ${new Date().toLocaleString('pt-BR')}]${input.notes ? ` ${input.notes}` : ''}`;
  const { error } = await supabase
    .from('julia_orders')
    .update({
      status: 'paid',
      paid_amount: input.paidAmountCents,
      fee_amount: input.feeAmountCents || 0,
      net_amount: net,
      paid_at: input.paidAt,
      notes: order.notes ? `${order.notes}\n${noteLine}` : noteLine,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);
  if (error) throw error;
}
