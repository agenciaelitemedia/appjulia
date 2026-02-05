export interface AdAccount {
  id: string;
  account_id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  business_name?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time?: string;
  updated_time?: string;
}

export interface AdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: Record<string, unknown>;
  optimization_goal?: string;
}

export interface Ad {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  adset_id: string;
  creative?: {
    id: string;
    name?: string;
    thumbnail_url?: string;
    object_story_spec?: Record<string, unknown>;
  };
}

export interface CampaignInsights {
  impressions: string;
  clicks: string;
  ctr: string;
  cpm: string;
  cpc: string;
  spend: string;
  reach: string;
  frequency: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
  cost_per_action_type?: Array<{
    action_type: string;
    value: string;
  }>;
}

export interface Pixel {
  id: string;
  name: string;
  code?: string;
  creation_time?: string;
  last_fired_time?: string;
}

export interface ConversionEvent {
  eventName: 'Lead' | 'ViewContent' | 'Purchase' | 'AddToCart' | 'InitiateCheckout' | 'CompleteRegistration' | 'Contact' | 'Subscribe';
  actionSource: 'website' | 'app' | 'phone_call' | 'chat' | 'email' | 'other' | 'system_generated';
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    country?: string;
    externalId?: string;
  };
  customData?: {
    value?: number;
    currency?: string;
    contentName?: string;
    leadSource?: string;
    campaignId?: string;
    status?: string;
  };
  eventTime?: number;
  eventSourceUrl?: string;
}

export interface MetaAdsState {
  accessToken: string | null;
  selectedAccountId: string | null;
  selectedPixelId: string | null;
  adAccounts: AdAccount[];
  campaigns: Campaign[];
  pixels: Pixel[];
  isLoading: boolean;
  error: string | null;
}
