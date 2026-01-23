// ============================================
// Labels Endpoints
// WhatsApp labels/tags management
// ============================================

import { UaZapiClient } from '../client';
import type { ApiResponse, Label, CreateLabelRequest, UpdateLabelRequest } from '../types';

export interface LabelsEndpoints {
  /**
   * Get all labels
   * GET /labels/list
   */
  list: () => Promise<Label[]>;
  
  /**
   * Create a new label
   * POST /labels/create
   */
  create: (data: CreateLabelRequest) => Promise<ApiResponse<Label>>;
  
  /**
   * Update an existing label
   * POST /labels/update
   */
  update: (data: UpdateLabelRequest) => Promise<ApiResponse>;
  
  /**
   * Delete a label
   * POST /labels/delete
   */
  delete: (id: string) => Promise<ApiResponse>;
}

export function createLabelsEndpoints(client: UaZapiClient | null): LabelsEndpoints {
  const assertClient = (): UaZapiClient => {
    if (!client) {
      throw new Error('UaZapi client not configured');
    }
    return client;
  };

  return {
    async list(): Promise<Label[]> {
      return assertClient().get<Label[]>('/labels/list');
    },

    async create(data: CreateLabelRequest): Promise<ApiResponse<Label>> {
      return assertClient().post<ApiResponse<Label>>('/labels/create', data);
    },

    async update(data: UpdateLabelRequest): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/labels/update', data);
    },

    async delete(id: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/labels/delete', { id });
    },
  };
}
