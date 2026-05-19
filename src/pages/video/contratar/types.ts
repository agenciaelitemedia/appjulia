export type BillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface VideoPlan {
  id: number;
  name: string;
  slug: string | null;
  included_minutes: number;
  max_concurrent_rooms: number;
  recording_included: boolean;
  transcription_included: boolean;
  price_monthly: number | null;
  price_quarterly: number | null;
  price_semiannual: number | null;
  price_annual: number | null;
  extra_minutes_pack_size: number;
  extra_minutes_pack_price: number;
  recording_addon_price: number | null;
  transcription_addon_price: number | null;
  setup_fee_monthly: number | null;
  setup_fee_quarterly: number | null;
  setup_fee_semiannual: number | null;
  setup_fee_annual: number | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface ContractDraft {
  plan: VideoPlan | null;
  billing_period: BillingPeriod;
  extra_minute_packs: number;
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

export function priceForPeriod(plan: VideoPlan, period: BillingPeriod): number {
  const map: Record<BillingPeriod, keyof VideoPlan> = {
    monthly: 'price_monthly',
    quarterly: 'price_quarterly',
    semiannual: 'price_semiannual',
    annual: 'price_annual',
  };
  return Number(plan[map[period]] ?? 0);
}

export function setupFeeForPeriod(plan: VideoPlan, period: BillingPeriod): number | null {
  const map: Record<BillingPeriod, keyof VideoPlan> = {
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

export function isAddonsFree(period: BillingPeriod): boolean {
  return period === 'semiannual' || period === 'annual';
}

export function calculateTotal(d: ContractDraft): {
  plan: number; setup: number; recording: number; transcription: number; extras: number; total: number;
} {
  if (!d.plan) return { plan: 0, setup: 0, recording: 0, transcription: 0, extras: 0, total: 0 };
  const months = PERIOD_MONTHS[d.billing_period];
  const planTotal = priceForPeriod(d.plan, d.billing_period);
  const setup = setupFeeForPeriod(d.plan, d.billing_period) ?? 0;
  const isFree = isAddonsFree(d.billing_period);
  const recUnit = d.plan.recording_included ? 0 : Number(d.plan.recording_addon_price ?? 99.9);
  const trUnit = d.plan.transcription_included ? 0 : Number(d.plan.transcription_addon_price ?? 99.9);
  const recording = d.recording_enabled && !d.plan.recording_included
    ? (isFree ? 0 : recUnit * months) : 0;
  const transcription = d.transcription_enabled && !d.plan.transcription_included
    ? (isFree ? 0 : trUnit * months) : 0;
  const extras = d.extra_minute_packs * Number(d.plan.extra_minutes_pack_price ?? 0) * months;
  const total = planTotal + setup + recording + transcription + extras;
  return { plan: planTotal, setup, recording, transcription, extras, total };
}