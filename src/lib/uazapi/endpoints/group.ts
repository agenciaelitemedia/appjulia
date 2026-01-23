// ============================================
// Group Endpoints
// Groups and communities management
// ============================================

import { UaZapiClient } from '../client';
import type {
  ApiResponse,
  CreateCommunityRequest,
  CreateCommunityResponse,
  EditCommunityGroupsRequest,
  CreateGroupRequest,
  GroupInfo,
  UpdateGroupRequest,
  GroupParticipantsRequest,
} from '../types';

export interface GroupEndpoints {
  community: {
    /**
     * Create a new community
     * POST /community/create
     */
    create: (name: string) => Promise<CreateCommunityResponse>;
    
    /**
     * Add or remove groups from a community
     * POST /community/editgroups
     */
    editGroups: (data: EditCommunityGroupsRequest) => Promise<ApiResponse>;
  };
  
  /**
   * Create a new group
   * POST /group/create
   */
  create: (data: CreateGroupRequest) => Promise<ApiResponse<GroupInfo>>;
  
  /**
   * Get group info
   * POST /group/info
   */
  getInfo: (groupId: string) => Promise<GroupInfo>;
  
  /**
   * Get group invite link
   * POST /group/invite
   */
  getInviteLink: (groupId: string) => Promise<ApiResponse<string>>;
  
  /**
   * Revoke group invite link
   * POST /group/revoke
   */
  revokeInviteLink: (groupId: string) => Promise<ApiResponse<string>>;
  
  /**
   * Update group info (subject/description)
   * POST /group/update
   */
  update: (data: UpdateGroupRequest) => Promise<ApiResponse>;
  
  /**
   * Update group picture
   * POST /group/picture
   */
  updatePicture: (groupId: string, imageBase64: string) => Promise<ApiResponse>;
  
  /**
   * Manage group participants
   * POST /group/participants
   */
  manageParticipants: (data: GroupParticipantsRequest) => Promise<ApiResponse>;
  
  /**
   * Leave a group
   * POST /group/leave
   */
  leave: (groupId: string) => Promise<ApiResponse>;
  
  /**
   * Get all groups
   * GET /group/list
   */
  list: () => Promise<GroupInfo[]>;
}

export function createGroupEndpoints(client: UaZapiClient | null): GroupEndpoints {
  const assertClient = (): UaZapiClient => {
    if (!client) {
      throw new Error('UaZapi client not configured');
    }
    return client;
  };

  return {
    community: {
      async create(name: string): Promise<CreateCommunityResponse> {
        const request: CreateCommunityRequest = { name };
        return assertClient().post<CreateCommunityResponse>('/community/create', request);
      },

      async editGroups(data: EditCommunityGroupsRequest): Promise<ApiResponse> {
        return assertClient().post<ApiResponse>('/community/editgroups', data);
      },
    },

    async create(data: CreateGroupRequest): Promise<ApiResponse<GroupInfo>> {
      return assertClient().post<ApiResponse<GroupInfo>>('/group/create', data);
    },

    async getInfo(groupId: string): Promise<GroupInfo> {
      return assertClient().post<GroupInfo>('/group/info', { groupId });
    },

    async getInviteLink(groupId: string): Promise<ApiResponse<string>> {
      return assertClient().post<ApiResponse<string>>('/group/invite', { groupId });
    },

    async revokeInviteLink(groupId: string): Promise<ApiResponse<string>> {
      return assertClient().post<ApiResponse<string>>('/group/revoke', { groupId });
    },

    async update(data: UpdateGroupRequest): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/update', data);
    },

    async updatePicture(groupId: string, imageBase64: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/picture', { groupId, image: imageBase64 });
    },

    async manageParticipants(data: GroupParticipantsRequest): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/participants', data);
    },

    async leave(groupId: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/leave', { groupId });
    },

    async list(): Promise<GroupInfo[]> {
      return assertClient().get<GroupInfo[]>('/group/list');
    },
  };
}
