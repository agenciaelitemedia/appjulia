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

  const stats = {
    total: orders.length,
    paid: orders.filter(o => o.status === 'paid').length,
    pending: orders.filter(o => o.status === 'pending').length,
    draft: orders.filter(o => o.status === 'draft').length,
    totalRevenue: orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + (o.paid_amount || o.plan_price), 0),
  };

  return { orders, isLoading, error, refetch: fetchOrders, stats };
}
