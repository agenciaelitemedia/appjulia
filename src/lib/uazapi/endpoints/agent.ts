// ============================================
// Agent Endpoints
// AI Agent configuration and management
// ============================================

import { UaZapiClient } from '../client';
import type { AgentConfig, AgentListItem, ApiResponse } from '../types';

export interface AgentEndpoints {
  /**
   * Create or edit an AI agent
   * POST /agent/edit
   */
  edit: (config: AgentConfig) => Promise<ApiResponse>;
  
  /**
   * List all AI agents
   * GET /agent/list
   */
  list: () => Promise<AgentListItem[]>;
}

export function createAgentEndpoints(client: UaZapiClient | null): AgentEndpoints {
  const assertClient = (): UaZapiClient => {
    if (!client) {
      throw new Error('UaZapi client not configured');
    }
    return client;
  };

  return {
    async edit(config: AgentConfig): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/agent/edit', config as unknown as Record<string, unknown>);
    },

    async list(): Promise<AgentListItem[]> {
      return assertClient().get<AgentListItem[]>('/agent/list');
    },
  };
}
