export interface EventLogEntry {
  id: string;
  timestamp: Date;
  type: string;
  data?: Record<string, unknown>;
}

export interface SignupData {
  waba_id?: string;
  phone_number_id?: string;
  code?: string;
}

export interface TokenData {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface WebhookLogEntry {
  id: string;
  from: string;
  message: string;
  timestamp: string;
}

// Facebook SDK types are in src/types/facebook-sdk.d.ts
