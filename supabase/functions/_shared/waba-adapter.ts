// ============================================
// WABA Adapter - Meta Official WhatsApp API
// Same interface as UaZapiAdapter for multi-provider support
// ============================================

import type { SendResult, InstanceStatus } from "./uazapi-adapter.ts";

const GRAPH_API_VERSION = "v22.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class WabaAdapter {
  private accessToken: string;
  private phoneNumberId: string;
  private maxRetries: number;

  constructor(accessToken: string, phoneNumberId: string, maxRetries = 2) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.maxRetries = maxRetries;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const url = `${GRAPH_API_BASE}${endpoint}`;
        console.log(`[WABA] ${method} ${endpoint} (attempt ${attempt + 1})`);

        const resp = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        const text = await resp.text();
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          data = { response: text };
        }

        if (!resp.ok) {
          console.error(`[WABA] HTTP ${resp.status}: ${text.substring(0, 200)}`);
          if (resp.status >= 400 && resp.status < 500) {
            throw new Error(`WABA HTTP ${resp.status}: ${text.substring(0, 200)}`);
          }
          throw new Error(`WABA HTTP ${resp.status}`);
        }

        console.log(`[WABA] Success: ${JSON.stringify(data).substring(0, 200)}`);
        return data as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError.message.includes('HTTP 4')) throw lastError;
        if (attempt < this.maxRetries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('WABA request failed');
  }

  private get messagesEndpoint(): string {
    return `/${this.phoneNumberId}/messages`;
  }

  // ========== Messaging ==========

  async sendText(number: string, text: string): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', this.messagesEndpoint, {
        messaging_product: 'whatsapp',
        to: number,
        type: 'text',
        text: { body: text },
      });

      const messages = data?.messages as Array<Record<string, unknown>> | undefined;
      return {
        success: true,
        messageId: messages?.[0]?.id as string || undefined,
        rawResponse: data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendMedia(
    number: string,
    mediaUrl: string,
    caption?: string,
    type: 'image' | 'video' | 'audio' | 'document' = 'image',
  ): Promise<SendResult> {
    try {
      const mediaBody: Record<string, unknown> = { link: mediaUrl };
      if (caption && type !== 'audio') mediaBody.caption = caption;

      const data = await this.request<Record<string, unknown>>('POST', this.messagesEndpoint, {
        messaging_product: 'whatsapp',
        to: number,
        type,
        [type]: mediaBody,
      });

      const messages = data?.messages as Array<Record<string, unknown>> | undefined;
      return {
        success: true,
        messageId: messages?.[0]?.id as string || undefined,
        rawResponse: data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendLocation(
    number: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
  ): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', this.messagesEndpoint, {
        messaging_product: 'whatsapp',
        to: number,
        type: 'location',
        location: { latitude, longitude, name: name || '', address: address || '' },
      });

      return { success: true, rawResponse: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendContact(
    number: string,
    contactName: string,
    contactPhone: string,
  ): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', this.messagesEndpoint, {
        messaging_product: 'whatsapp',
        to: number,
        type: 'contacts',
        contacts: [{
          name: { formatted_name: contactName },
          phones: [{ phone: contactPhone, type: 'CELL' }],
        }],
      });

      return { success: true, rawResponse: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendMenu(
    number: string,
    text: string,
    buttons: Array<{ id: string; title: string }>,
    _title?: string,
    footer?: string,
  ): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', this.messagesEndpoint, {
        messaging_product: 'whatsapp',
        to: number,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          ...(footer ? { footer: { text: footer } } : {}),
          action: {
            buttons: buttons.slice(0, 3).map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title.substring(0, 20) },
            })),
          },
        },
      });

      return { success: true, rawResponse: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ========== Instance ==========

  async getStatus(): Promise<InstanceStatus> {
    try {
      const data = await this.request<Record<string, unknown>>('GET', `/${this.phoneNumberId}`);
      return {
        status: data?.verified_name ? 'connected' : 'unknown',
        profileName: data?.verified_name as string,
        isBusiness: true,
        owner: data?.display_phone_number as string,
      };
    } catch {
      return { status: 'error' };
    }
  }

  // ========== Chat ==========

  async checkNumbers(_numbers: string[]): Promise<Array<{ number: string; exists: boolean; jid?: string }>> {
    // WABA does not support number checking
    return _numbers.map(n => ({ number: n, exists: true }));
  }
}
