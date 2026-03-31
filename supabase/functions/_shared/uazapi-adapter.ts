// ============================================
// UaZapi Adapter - Server-side (Edge Functions)
// Reusable adapter for all UaZapi API calls
// ============================================

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rawResponse?: unknown;
}

export interface InstanceStatus {
  status: string;
  profileName?: string;
  isBusiness?: boolean;
  owner?: string;
}

export interface CheckNumberResult {
  number: string;
  exists: boolean;
  jid?: string;
}

export class UaZapiAdapter {
  private baseUrl: string;
  private token: string;
  private maxRetries: number;

  constructor(baseUrl: string, token: string, maxRetries = 2) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
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
        const url = `${this.baseUrl}${endpoint}`;
        console.log(`[UaZapi] ${method} ${endpoint} (attempt ${attempt + 1})`);

        const resp = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'token': this.token,
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
          console.error(`[UaZapi] HTTP ${resp.status}: ${text.substring(0, 200)}`);
          if (resp.status >= 400 && resp.status < 500) {
            throw new Error(`UaZapi HTTP ${resp.status}: ${text.substring(0, 200)}`);
          }
          throw new Error(`UaZapi HTTP ${resp.status}`);
        }

        console.log(`[UaZapi] Success: ${JSON.stringify(data).substring(0, 200)}`);
        return data as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Don't retry 4xx errors
        if (lastError.message.includes('HTTP 4')) throw lastError;
        if (attempt < this.maxRetries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('UaZapi request failed');
  }

  // ========== Messaging ==========

  async sendText(number: string, text: string): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', '/send/text', {
        number,
        text,
      });
      return {
        success: true,
        messageId: (data?.key as Record<string, unknown>)?.id as string || undefined,
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
      const data = await this.request<Record<string, unknown>>('POST', '/send/media', {
        number,
        mediaUrl,
        caption: caption || '',
        mediaType: type,
      });
      return {
        success: true,
        messageId: (data?.key as Record<string, unknown>)?.id as string || undefined,
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
      const data = await this.request<Record<string, unknown>>('POST', '/send/location', {
        number,
        latitude,
        longitude,
        name: name || '',
        address: address || '',
      });
      return {
        success: true,
        rawResponse: data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendContact(
    number: string,
    contactName: string,
    contactPhone: string,
  ): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', '/send/contact', {
        number,
        contact: { fullName: contactName, phoneNumber: contactPhone },
      });
      return {
        success: true,
        rawResponse: data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendMenu(
    number: string,
    text: string,
    buttons: Array<{ id: string; title: string }>,
    title?: string,
    footer?: string,
  ): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', '/send/menu', {
        number,
        text,
        title: title || '',
        footer: footer || '',
        buttons,
      });
      return {
        success: true,
        rawResponse: data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ========== Instance ==========

  async getStatus(): Promise<InstanceStatus> {
    const data = await this.request<Record<string, unknown>>('GET', '/instance/status');
    return {
      status: (data?.status as string) || 'unknown',
      profileName: data?.profileName as string,
      isBusiness: data?.isBusiness as boolean,
      owner: data?.owner as string,
    };
  }

  // ========== Chat ==========

  async checkNumbers(numbers: string[]): Promise<CheckNumberResult[]> {
    const data = await this.request<Array<Record<string, unknown>>>('POST', '/chat/checkPhone', {
      numbers,
    });
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      number: (item.number as string) || '',
      exists: !!item.exists,
      jid: item.jid as string,
    }));
  }
}
