export interface PhonePlan {
  id: number;
  name: string;
  max_extensions: number;
  price: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PhoneUserPlan {
  id: number;
  cod_agent: string;
  plan_id: number;
  is_active: boolean;
  assigned_at: string;
  // joined
  plan_name?: string;
  max_extensions?: number;
  used_extensions?: number;
}

export interface PhoneConfig {
  id: number;
  cod_agent: string;
  api4com_domain: string;
  api4com_token: string;
  sip_domain: string | null;
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
  api4com_id: string | null;
  api4com_ramal: string | null;
  api4com_password: string | null;
  api4com_email: string | null;
  api4com_first_name: string | null;
  api4com_last_name: string | null;
  api4com_raw: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  assigned_member_name?: string;
}
