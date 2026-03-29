export type ProviderType = 'api4com' | '3cplus';

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  api4com: 'Api4Com',
  '3cplus': '3C+',
};

export interface PhonePlan {
  id: number;
  name: string;
  max_extensions: number;
  price: number;
  price_monthly: number;
  price_quarterly: number;
  price_semiannual: number;
  price_annual: number;
  extra_extension_price: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

export const BILLING_PERIOD_MONTHS: Record<BillingPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export function getPlanPriceByPeriod(plan: PhonePlan, period: BillingPeriod): number {
  const map: Record<BillingPeriod, number> = {
    monthly: plan.price_monthly,
    quarterly: plan.price_quarterly,
    semiannual: plan.price_semiannual,
    annual: plan.price_annual,
  };
  return Number(map[period]) || 0;
}

export interface PhoneUserPlan {
  id: number;
  cod_agent: string;
  plan_id: number;
  is_active: boolean;
  assigned_at: string;
  billing_period: BillingPeriod;
  extra_extensions: number;
  start_date: string;
  due_date: string | null;
  client_name: string | null;
  business_name: string | null;
  // joined
  plan_name?: string;
  max_extensions?: number;
  price_monthly?: number;
  price_quarterly?: number;
  price_semiannual?: number;
  price_annual?: number;
  extra_extension_price?: number;
}

export interface PhoneConfig {
  id: number;
  cod_agent: string;
  provider: ProviderType;
  // Api4Com fields
  api4com_domain: string;
  api4com_token: string;
  sip_domain: string | null;
  // 3C+ fields
  threecplus_token: string | null;
  threecplus_base_url: string | null;
  threecplus_ws_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PhoneCallLog {
  id: number;
  call_id: string | null;
  cod_agent: string | null;
  extension_number: string | null;
  direction: string | null;
  caller: string | null;
  called: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  hangup_cause: string | null;
  record_url: string | null;
  cost: number;
  metadata: any;
  created_at: string;
}

export interface PhoneExtension {
  id: number;
  cod_agent: string;
  extension_number: string;
  assigned_member_id: number | null;
  label: string | null;
  provider: ProviderType;
  // Api4Com fields
  api4com_id: string | null;
  api4com_ramal: string | null;
  api4com_password: string | null;
  api4com_email: string | null;
  api4com_first_name: string | null;
  api4com_last_name: string | null;
  api4com_raw: any;
  // 3C+ fields
  threecplus_agent_id: string | null;
  threecplus_extension: string | null;
  threecplus_sip_username: string | null;
  threecplus_sip_password: string | null;
  threecplus_sip_domain: string | null;
  threecplus_raw: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assigned_member_name?: string;
}
