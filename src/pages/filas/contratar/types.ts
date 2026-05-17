export type BillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface QueuePlan {
  id: number;
  name: string;
  max_queues: number;
  price_monthly: number | null;
  price_quarterly: number | null;
  price_semiannual: number | null;
  price_annual: number | null;
  extra_queue_price: number | null;
  setup_fee_monthly: number | null;
  setup_fee_quarterly: number | null;
  setup_fee_semiannual: number | null;
  setup_fee_annual: number | null;
  description: string | null;
  is_active: boolean;
}

export interface ContractDraft {
  plan: QueuePlan | null;
  billing_period: BillingPeriod;
  extra_queues: number;
  customer_name: string;
  customer_document: string;
  customer_email: string;
  customer_whatsapp: string;
}

export const PERIOD_LABELS: Record<BillingPeriod, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

export const PERIOD_MONTHS: Record<BillingPeriod, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12,
};

export function priceForPeriod(plan: QueuePlan, period: BillingPeriod): number {
  const map: Record<BillingPeriod, keyof QueuePlan> = {
    monthly: 'price_monthly',
    quarterly: 'price_quarterly',
    semiannual: 'price_semiannual',
    annual: 'price_annual',
  };
  return Number(plan[map[period]] ?? 0);
}

export function setupFeeForPeriod(plan: QueuePlan, period: BillingPeriod): number | null {
  const map: Record<BillingPeriod, keyof QueuePlan> = {
    monthly: 'setup_fee_monthly',
    quarterly: 'setup_fee_quarterly',
    semiannual: 'setup_fee_semiannual',
    annual: 'setup_fee_annual',
  };
  const raw = plan[map[period]];
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function calculateTotal(d: ContractDraft): {
  plan: number; setup: number; extras: number; total: number;
} {
  if (!d.plan) return { plan: 0, setup: 0, extras: 0, total: 0 };
  const months = PERIOD_MONTHS[d.billing_period];
  const planTotal = priceForPeriod(d.plan, d.billing_period);
  const setup = setupFeeForPeriod(d.plan, d.billing_period) ?? 0;
  const extras = d.extra_queues * Number(d.plan.extra_queue_price ?? 0) * months;
  const total = planTotal + setup + extras;
  return { plan: planTotal, setup, extras, total };
}