// ============================================
// Chat Endpoints
// Chat management and operations
// ============================================

import { UaZapiClient } from '../client';
import type {
  ApiResponse,
  ArchiveChatRequest,
  BlockChatRequest,
  BlockListResponse,
  CheckNumbersRequest,
  CheckNumberResult,
  DeleteChatRequest,
  DeleteChatResponse,
  ChatDetailsRequest,
  ChatDetails,
  EditLeadRequest,
  FindChatsRequest,
  FindChatsResponse,
  SetLabelsRequest,
  SetLabelsResponse,
  MuteChatRequest,
  PinChatRequest,
  ReadChatRequest,
} from '../types';

export interface ChatEndpoints {
  /**
   * Archive or unarchive a chat
   * POST /chat/archive
   */
  archive: (data: ArchiveChatRequest) => Promise<ApiResponse<string>>;
  
  /**
   * Block or unblock a contact
   * POST /chat/block
   */
  block: (data: BlockChatRequest) => Promise<ApiResponse<string> & { blockList: string[] }>;
  
  /**
   * Get list of blocked contacts
   * GET /chat/blocklist
   */
  getBlocklist: () => Promise<BlockListResponse>;
  
  /**
   * Check if numbers are registered on WhatsApp
   * POST /chat/check
   */
  checkNumbers: (numbers: string[]) => Promise<CheckNumberResult[]>;
  
  /**
   * Delete a chat
   * POST /chat/delete
   */
  delete: (data: DeleteChatRequest) => Promise<DeleteChatResponse>;
  
  /**
   * Get complete chat details
   * POST /chat/details
   */
  getDetails: (data: ChatDetailsRequest) => Promise<ChatDetails>;
  
  /**
   * Edit lead information
   * POST /chat/editLead
   */
  editLead: (data: EditLeadRequest) => Promise<ApiResponse>;
  
  /**
   * Find chats with filters
   * POST /chat/find
   */
  find: (filters: FindChatsRequest) => Promise<FindChatsResponse>;
  
  /**
   * Manage chat labels
   * POST /chat/labels
   */
  setLabels: (data: SetLabelsRequest) => Promise<SetLabelsResponse>;
  
  /**
   * Mute chat notifications
   * POST /chat/mute
   */
  mute: (data: MuteChatRequest) => Promise<ApiResponse<string>>;
  
  /**
   * Pin or unpin a chat
   * POST /chat/pin
   */
  pin: (data: PinChatRequest) => Promise<ApiResponse<string>>;
  
  /**
   * Mark chat as read or unread
   * POST /chat/read
   */
  markRead: (data: ReadChatRequest) => Promise<ApiResponse<string>>;
}

export function createChatEndpoints(client: UaZapiClient | null): ChatEndpoints {
  const assertClient = (): UaZapiClient => {
    if (!client) {
      throw new Error('UaZapi client not configured');
    }
    return client;
  };

  return {
    async archive(data: ArchiveChatRequest): Promise<ApiResponse<string>> {
      return assertClient().post<ApiResponse<string>>('/chat/archive', data);
    },

    async block(data: BlockChatRequest): Promise<ApiResponse<string> & { blockList: string[] }> {
      return assertClient().post<ApiResponse<string> & { blockList: string[] }>('/chat/block', data);
    },

    async getBlocklist(): Promise<BlockListResponse> {
      return assertClient().get<BlockListResponse>('/chat/blocklist');
    },

    async checkNumbers(numbers: string[]): Promise<CheckNumberResult[]> {
      const request: CheckNumbersRequest = { numbers };
      return assertClient().post<CheckNumberResult[]>('/chat/check', request);
    },

    async delete(data: DeleteChatRequest): Promise<DeleteChatResponse> {
      return assertClient().post<DeleteChatResponse>('/chat/delete', data);
    },

    async getDetails(data: ChatDetailsRequest): Promise<ChatDetails> {
      return assertClient().post<ChatDetails>('/chat/details', data);
    },

    async editLead(data: EditLeadRequest): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/chat/editLead', data);
    },

    async find(filters: FindChatsRequest): Promise<FindChatsResponse> {
      return assertClient().post<FindChatsResponse>('/chat/find', filters);
    },

    async setLabels(data: SetLabelsRequest): Promise<SetLabelsResponse> {
      return assertClient().post<SetLabelsResponse>('/chat/labels', data);
    },

    async mute(data: MuteChatRequest): Promise<ApiResponse<string>> {
      return assertClient().post<ApiResponse<string>>('/chat/mute', data);
    },

    async pin(data: PinChatRequest): Promise<ApiResponse<string>> {
      return assertClient().post<ApiResponse<string>>('/chat/pin', data);
    },

    async markRead(data: ReadChatRequest): Promise<ApiResponse<string>> {
      return assertClient().post<ApiResponse<string>>('/chat/read', data);
    },
  };
}
