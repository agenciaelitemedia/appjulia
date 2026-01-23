// ============================================
// Chatwoot Endpoints
// Chatwoot integration configuration
// ============================================

import { UaZapiClient } from '../client';
import type {
  ChatwootConfig,
  UpdateChatwootConfigRequest,
  UpdateChatwootConfigResponse,
} from '../types';

export interface ChatwootEndpoints {
  /**
   * Get Chatwoot configuration
   * GET /chatwoot/config
   */
  getConfig: () => Promise<ChatwootConfig>;
  
  /**
   * Update Chatwoot configuration
   * PUT /chatwoot/config
   */
  updateConfig: (data: UpdateChatwootConfigRequest) => Promise<UpdateChatwootConfigResponse>;
}

export function createChatwootEndpoints(client: UaZapiClient | null): ChatwootEndpoints {
  const assertClient = (): UaZapiClient => {
    if (!client) {
      throw new Error('UaZapi client not configured');
    }
    return client;
  };

  return {
    async getConfig(): Promise<ChatwootConfig> {
      return assertClient().get<ChatwootConfig>('/chatwoot/config');
    },

    async updateConfig(data: UpdateChatwootConfigRequest): Promise<UpdateChatwootConfigResponse> {
      return assertClient().put<UpdateChatwootConfigResponse>('/chatwoot/config', data);
    },
  };
}
