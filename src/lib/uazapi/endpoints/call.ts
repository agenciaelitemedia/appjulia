// ============================================
// Call Endpoints
// Voice call management
// ============================================

import { UaZapiClient } from '../client';
import type { ApiResponse, MakeCallRequest, RejectCallRequest } from '../types';

export interface CallEndpoints {
  /**
   * Make a voice call
   * POST /call/make
   */
  make: (number: string) => Promise<ApiResponse<string>>;
  
  /**
   * Reject an incoming call
   * POST /call/reject
   */
  reject: (data?: RejectCallRequest) => Promise<ApiResponse<string>>;
}

export function createCallEndpoints(client: UaZapiClient | null): CallEndpoints {
  const assertClient = (): UaZapiClient => {
    if (!client) {
      throw new Error('UaZapi client not configured');
    }
    return client;
  };

  return {
    async make(number: string): Promise<ApiResponse<string>> {
      const request: MakeCallRequest = { number };
      return assertClient().post<ApiResponse<string>>('/call/make', request);
    },

    async reject(data?: RejectCallRequest): Promise<ApiResponse<string>> {
      return assertClient().post<ApiResponse<string>>('/call/reject', data || {});
    },
  };
}
