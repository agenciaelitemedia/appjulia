// ============================================
// Messaging Factory - Multi-Provider Support
// Returns the correct adapter based on agent hub
// ============================================

import type { SendResult, InstanceStatus, CheckNumberResult } from "./uazapi-adapter.ts";
import { UaZapiAdapter } from "./uazapi-adapter.ts";
import { WabaAdapter } from "./waba-adapter.ts";

export interface MessagingAdapter {
  sendText(number: string, text: string): Promise<SendResult>;
  sendMedia(number: string, mediaUrl: string, caption?: string, type?: 'image' | 'video' | 'audio' | 'document'): Promise<SendResult>;
  sendLocation(number: string, latitude: number, longitude: number, name?: string, address?: string): Promise<SendResult>;
  sendContact(number: string, contactName: string, contactPhone: string): Promise<SendResult>;
  sendMenu(number: string, text: string, buttons: Array<{ id: string; title: string }>, title?: string, footer?: string): Promise<SendResult>;
  getStatus(): Promise<InstanceStatus>;
  checkNumbers(numbers: string[]): Promise<CheckNumberResult[]>;
}

export interface AgentMessagingCredentials {
  hub: string;
  evo_url?: string | null;
  evo_apikey?: string | null;
  waba_token?: string | null;
  waba_number_id?: string | null;
}

export function createMessagingAdapter(creds: AgentMessagingCredentials): MessagingAdapter {
  if (creds.hub === 'uazapi') {
    if (!creds.evo_url || !creds.evo_apikey) {
      throw new Error('UaZapi credentials (evo_url, evo_apikey) missing');
    }
    return new UaZapiAdapter(creds.evo_url, creds.evo_apikey) as MessagingAdapter;
  }

  if (creds.hub === 'waba') {
    if (!creds.waba_token || !creds.waba_number_id) {
      throw new Error('WABA credentials (waba_token, waba_number_id) missing');
    }
    return new WabaAdapter(creds.waba_token, creds.waba_number_id) as MessagingAdapter;
  }

  throw new Error(`Unsupported messaging hub: ${creds.hub}`);
}
