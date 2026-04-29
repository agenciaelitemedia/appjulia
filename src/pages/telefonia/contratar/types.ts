export type BillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface PhonePlan {
  id: number;
  name: string;
  max_extensions: number;
  price_monthly: number | null;
  price_quarterly: number | null;
  price_semiannual: number | null;
  price_annual: number | null;
  extra_extension_price: number | null;
  description: string | null;
  is_active: boolean;
}

export interface ContractDraft {
  plan: PhonePlan | null;
  billing_period: BillingPeriod;
  extra_extensions: number;
  recording_enabled: boolean;
  transcription_enabled: boolean;
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

// Pricing rules (espelha a edge function — só pra display do resumo)
export const SETUP_FEE_MONTHLY_REAIS = 197;
export const ADDON_PRICE_MONTHLY_REAIS = 99.9;

export function priceForPeriod(plan: PhonePlan, period: BillingPeriod): number {
  const map: Record<BillingPeriod, keyof PhonePlan> = {
    monthly: 'price_monthly',
    quarterly: 'price_quarterly',
    semiannual: 'price_semiannual',
    annual: 'price_annual',
  };
  return Number(plan[map[period]] ?? 0);
}

export function isAddonsFree(period: BillingPeriod): boolean {
  return period === 'semiannual' || period === 'annual';
}

export function calculateTotal(d: ContractDraft): {
  plan: number; setup: number; recording: number; transcription: number; extras: number; total: number;
} {
  if (!d.plan) return { plan: 0, setup: 0, recording: 0, transcription: 0, extras: 0, total: 0 };
  const months = PERIOD_MONTHS[d.billing_period];
  const planTotal = priceForPeriod(d.plan, d.billing_period);
  const setup = d.billing_period === 'monthly' ? SETUP_FEE_MONTHLY_REAIS : 0;
  const addonUnit = isAddonsFree(d.billing_period) ? 0 : ADDON_PRICE_MONTHLY_REAIS;
  const recording = d.recording_enabled ? addonUnit * months : 0;
  const transcription = d.transcription_enabled ? addonUnit * months : 0;
  const extras = d.extra_extensions * Number(d.plan.extra_extension_price ?? 0) * months;
  const total = planTotal + setup + recording + transcription + extras;
  return { plan: planTotal, setup, recording, transcription, extras, total };
}
