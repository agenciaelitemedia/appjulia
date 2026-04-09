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
    create: (name: string) => Promise<CreateCommunityResponse>;
    editGroups: (data: EditCommunityGroupsRequest) => Promise<ApiResponse>;
  };
  
  create: (data: CreateGroupRequest) => Promise<ApiResponse<GroupInfo>>;
  getInfo: (groupjid: string, opts?: { noParticipants?: boolean; pictureUrl?: boolean }) => Promise<GroupInfo>;
  getInviteLink: (groupjid: string) => Promise<ApiResponse<string>>;
  revokeInviteLink: (groupjid: string) => Promise<ApiResponse<string>>;
  update: (data: UpdateGroupRequest) => Promise<ApiResponse>;
  updateName: (groupjid: string, name: string) => Promise<ApiResponse>;
  updateDescription: (groupjid: string, description: string) => Promise<ApiResponse>;
  updateImage: (groupjid: string, image: string) => Promise<ApiResponse>;
  updateAnnounce: (groupjid: string, announce: boolean) => Promise<ApiResponse>;
  updateLocked: (groupjid: string, locked: boolean) => Promise<ApiResponse>;
  manageParticipants: (data: GroupParticipantsRequest) => Promise<ApiResponse>;
  leave: (groupjid: string) => Promise<ApiResponse>;
  list: (force?: boolean, noParticipants?: boolean) => Promise<GroupInfo[]>;
  join: (invitecode: string) => Promise<ApiResponse>;
  inviteInfo: (invitecode: string) => Promise<GroupInfo>;
  resetInviteCode: (groupjid: string) => Promise<ApiResponse>;
}

export function createGroupEndpoints(client: UaZapiClient | null): GroupEndpoints {
  const assertClient = (): UaZapiClient => {
    if (!client) throw new Error('UaZapi client not configured');
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

    async getInfo(groupjid: string, opts?: { noParticipants?: boolean; pictureUrl?: boolean }): Promise<GroupInfo> {
      return assertClient().post<GroupInfo>('/group/info', { groupjid, ...opts });
    },

    async getInviteLink(groupjid: string): Promise<ApiResponse<string>> {
      return assertClient().post<ApiResponse<string>>('/group/invite', { groupjid });
    },

    async revokeInviteLink(groupjid: string): Promise<ApiResponse<string>> {
      return assertClient().post<ApiResponse<string>>('/group/revoke', { groupjid });
    },

    async update(data: UpdateGroupRequest): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/update', data);
    },

    async updateName(groupjid: string, name: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/updateName', { groupjid, name });
    },

    async updateDescription(groupjid: string, description: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/updateDescription', { groupjid, description });
    },

    async updateImage(groupjid: string, image: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/updateImage', { groupjid, image });
    },

    async updateAnnounce(groupjid: string, announce: boolean): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/updateAnnounce', { groupjid, announce });
    },

    async updateLocked(groupjid: string, locked: boolean): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/updateLocked', { groupjid, locked });
    },

    async manageParticipants(data: GroupParticipantsRequest): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/updateParticipants', data);
    },

    async leave(groupjid: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/leave', { groupjid });
    },

    async list(force?: boolean, noParticipants?: boolean): Promise<GroupInfo[]> {
      let endpoint = '/group/list';
      const params: string[] = [];
      if (force) params.push('force=true');
      if (noParticipants) params.push('noParticipants=true');
      if (params.length) endpoint += '?' + params.join('&');
      return assertClient().get<GroupInfo[]>(endpoint);
    },

    async join(invitecode: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/join', { invitecode });
    },

    async inviteInfo(invitecode: string): Promise<GroupInfo> {
      return assertClient().post<GroupInfo>('/group/inviteInfo', { invitecode });
    },

    async resetInviteCode(groupjid: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/group/resetInviteCode', { groupjid });
    },
  };
}
