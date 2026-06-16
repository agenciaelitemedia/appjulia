// ============================================
// UaZapi Adapter - Server-side (Edge Functions)
// Complete hub for all UaZapi API endpoints
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

export interface GroupParticipant {
  jid: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
}

export interface GroupInfo {
  jid: string;
  name: string;
  owner?: string;
  description?: string;
  size: number;
  participants: GroupParticipant[];
  isLocked?: boolean;
  isAnnounce?: boolean;
  isCommunity?: boolean;
  pictureUrl?: string;
  creation?: number;
}

export interface LabelInfo {
  id: string;
  labelId?: string;
  name: string;
  color: number;
  predefinedId?: string;
}

export interface ChatInfo {
  id: string;
  name?: string;
  phone?: string;
  isGroup?: boolean;
  isArchived?: boolean;
  isBlocked?: boolean;
  unreadCount?: number;
  lastMsgTimestamp?: number;
  profilePictureUrl?: string;
  leadName?: string;
  leadStatus?: string;
  leadTags?: string[];
  [key: string]: unknown;
}

export class UaZapiAdapter {
  private baseUrl: string;
  private token: string;
  private maxRetries: number;

  constructor(baseUrl: string, token: string, maxRetries = 2) {
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
        if (lastError.message.includes('HTTP 4')) throw lastError;
        if (attempt < this.maxRetries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('UaZapi request failed');
  }

  // ========== Messaging ==========

  async sendText(number: string, text: string, quotedMessageId?: string): Promise<SendResult> {
    try {
      const body: Record<string, unknown> = { number, text };
      if (quotedMessageId) body.quotedMessageId = quotedMessageId;
      const data = await this.request<Record<string, unknown>>('POST', '/send/text', body);
      return {
        success: true,
        messageId: (data?.key as Record<string, unknown>)?.id as string || undefined,
        rawResponse: data,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
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
        number, mediaUrl, mediaType: type,
        text: type === 'audio' ? undefined : (caption || ''),
        caption: caption || '',
      });
      return {
        success: true,
        messageId: (data?.key as Record<string, unknown>)?.id as string || undefined,
        rawResponse: data,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendLocation(
    number: string, latitude: number, longitude: number,
    name?: string, address?: string,
  ): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', '/send/location', {
        number, latitude, longitude, name: name || '', address: address || '',
      });
      return { success: true, rawResponse: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendContact(number: string, contactName: string, contactPhone: string): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', '/send/contact', {
        number, contact: { fullName: contactName, phoneNumber: contactPhone },
      });
      return { success: true, rawResponse: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendMenu(
    number: string, text: string,
    buttons: Array<{ id: string; title: string }>,
    title?: string, footer?: string,
  ): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', '/send/menu', {
        number, text, title: title || '', footer: footer || '', buttons,
      });
      return { success: true, rawResponse: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendCarousel(
    number: string, text: string,
    cards: Array<{ title: string; body: string; footer?: string; mediaUrl?: string; buttons: Array<{ id: string; title: string }> }>,
  ): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', '/send/carousel', {
        number, text, cards,
      });
      return { success: true, rawResponse: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendLocationButton(
    number: string, text: string, buttonText: string,
  ): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', '/send/locationButton', {
        number, text, buttonText,
      });
      return { success: true, rawResponse: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendPixButton(
    number: string, text: string, pixKey: string,
    pixKeyType: string, merchantName: string, amount: number,
  ): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', '/send/pixButton', {
        number, text, pixKey, pixKeyType, merchantName, amount,
      });
      return { success: true, rawResponse: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendRequestPayment(
    number: string, amount: number, currencyCode: string,
    note?: string, expiryTimestamp?: number,
  ): Promise<SendResult> {
    try {
      const data = await this.request<Record<string, unknown>>('POST', '/send/requestPayment', {
        number, amount, currencyCode, note: note || '', expiryTimestamp,
      });
      return { success: true, rawResponse: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
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

  async getQRCode(): Promise<{ qrcode?: string; status: string }> {
    const data = await this.request<Record<string, unknown>>('GET', '/instance/qrcode');
    return {
      qrcode: data?.qrcode as string,
      status: (data?.status as string) || 'unknown',
    };
  }

  async reconnect(): Promise<{ status: string }> {
    const data = await this.request<Record<string, unknown>>('POST', '/instance/reconnect', {});
    return { status: (data?.status as string) || 'reconnecting' };
  }

  async logout(): Promise<{ status: string }> {
    const data = await this.request<Record<string, unknown>>('POST', '/instance/logout', {});
    return { status: (data?.status as string) || 'logged_out' };
  }

  // ========== Chat ==========

  async checkNumbers(numbers: string[]): Promise<CheckNumberResult[]> {
    const data = await this.request<Array<Record<string, unknown>>>('POST', '/chat/checkPhone', { numbers });
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      number: (item.number as string) || '',
      exists: !!item.exists,
      jid: item.jid as string,
    }));
  }

  async findChats(filters: Record<string, unknown>): Promise<{ chats: ChatInfo[]; pagination?: Record<string, unknown> }> {
    const data = await this.request<Record<string, unknown>>('POST', '/chat/find', filters);
    const chats = Array.isArray(data?.chats) ? (data.chats as ChatInfo[]) : [];
    return { chats, pagination: data?.pagination as Record<string, unknown> };
  }

  async getChatDetails(number: string, preview?: boolean): Promise<ChatInfo> {
    return this.request<ChatInfo>('POST', '/chat/details', { number, preview });
  }

  async editLead(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/chat/editLead', data);
  }

  async archiveChat(number: string, archive: boolean): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/chat/archive', { number, archive });
  }

  async blockChat(number: string, block: boolean): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/chat/block', { number, block });
  }

  async deleteChat(number: string, opts?: { deleteChatDB?: boolean; deleteMessagesDB?: boolean; deleteChatWhatsApp?: boolean }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/chat/delete', { number, ...opts });
  }

  async muteChat(number: string, muteEndTime: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/chat/mute', { number, muteEndTime });
  }

  async pinChat(number: string, pin: boolean): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/chat/pin', { number, pin });
  }

  async readChat(number: string, read: boolean): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/chat/read', { number, read });
  }

  async setLabels(number: string, labelids?: string[], add_labelid?: string, remove_labelid?: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/chat/setLabels', { number, labelids, add_labelid, remove_labelid });
  }

  // ========== Groups ==========

  private normalizeGroup(g: Record<string, unknown>): GroupInfo {
    const participants = (g.Participants || g.participants || []) as Array<Record<string, unknown>>;
    return {
      jid: (g.JID || g.jid || g.id || '') as string,
      name: (g.Name || g.name || g.subject || '') as string,
      owner: (g.OwnerJID || g.owner || '') as string,
      description: (g.Description || g.description || g.desc || '') as string,
      size: (g.Size || g.size || participants.length || 0) as number,
      participants: participants.map((p: Record<string, unknown>) => ({
        jid: (p.JID || p.jid || p.id || '') as string,
        isAdmin: !!(p.IsAdmin || p.isAdmin || p.admin === 'admin' || p.admin === 'superadmin'),
        isSuperAdmin: !!(p.IsSuperAdmin || p.isSuperAdmin || p.admin === 'superadmin'),
      })),
      isLocked: !!(g.IsLocked || g.isLocked || g.restrict),
      isAnnounce: !!(g.IsAnnounce || g.isAnnounce || g.announce),
      isCommunity: !!(g.IsCommunity || g.isCommunity),
      pictureUrl: (g.ProfilePictureUrl || g.pictureUrl || g.profilePictureUrl || g.imgUrl || g.picture) as string | undefined,
      creation: (g.Creation || g.creation) as number | undefined,
    };
  }

  async listGroups(force?: boolean, noParticipants?: boolean): Promise<GroupInfo[]> {
    let endpoint = '/group/list';
    const params: string[] = [];
    if (force) params.push('force=true');
    if (noParticipants) params.push('noParticipants=true');
    if (params.length) endpoint += '?' + params.join('&');

    const data = await this.request<unknown>('GET', endpoint);
    
    let rawList: Record<string, unknown>[] = [];
    if (Array.isArray(data)) {
      rawList = data as Record<string, unknown>[];
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.groups)) rawList = obj.groups as Record<string, unknown>[];
      else if (Array.isArray(obj.data)) rawList = obj.data as Record<string, unknown>[];
    }

    return rawList.map(g => this.normalizeGroup(g));
  }

  async listGroupsPaginated(page: number, pageSize: number, search?: string): Promise<{ groups: GroupInfo[]; pagination?: Record<string, unknown> }> {
    const body: Record<string, unknown> = { page, pageSize };
    if (search) body.search = search;
    const data = await this.request<Record<string, unknown>>('POST', '/group/list', body);
    
    let rawList: Record<string, unknown>[] = [];
    if (Array.isArray(data?.groups)) rawList = data.groups as Record<string, unknown>[];
    else if (Array.isArray(data)) rawList = data as Record<string, unknown>[];

    return {
      groups: rawList.map(g => this.normalizeGroup(g)),
      pagination: data?.pagination as Record<string, unknown>,
    };
  }

  async getGroupInfo(groupjid: string, opts?: { noParticipants?: boolean; pictureUrl?: boolean }): Promise<GroupInfo> {
    const body: Record<string, unknown> = { groupjid };
    if (opts?.noParticipants) body.noParticipants = true;
    if (opts?.pictureUrl) body.pictureUrl = true;
    const data = await this.request<Record<string, unknown>>('POST', '/group/info', body);
    return this.normalizeGroup(data);
  }

  async createGroup(name: string, participants: string[]): Promise<GroupInfo> {
    const data = await this.request<Record<string, unknown>>('POST', '/group/create', { name, participants });
    return this.normalizeGroup(data);
  }

  async leaveGroup(groupjid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/group/leave', { groupjid });
  }

  async updateGroupName(groupjid: string, name: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/group/updateName', { groupjid, name });
  }

  async updateGroupDescription(groupjid: string, description: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/group/updateDescription', { groupjid, description });
  }

  async updateGroupImage(groupjid: string, image: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/group/updateImage', { groupjid, image });
  }

  async updateGroupAnnounce(groupjid: string, announce: boolean): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/group/updateAnnounce', { groupjid, announce });
  }

  async updateGroupLocked(groupjid: string, locked: boolean): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/group/updateLocked', { groupjid, locked });
  }

  async updateGroupParticipants(
    groupjid: string, action: 'add' | 'remove' | 'promote' | 'demote',
    participants: string[],
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/group/updateParticipants', {
      groupjid, action, participants,
    });
  }

  async resetGroupInviteCode(groupjid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/group/resetInviteCode', { groupjid });
  }

  async joinGroup(invitecode: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/group/join', { invitecode });
  }

  async getGroupInviteInfo(invitecode: string): Promise<GroupInfo> {
    const data = await this.request<Record<string, unknown>>('POST', '/group/inviteInfo', { invitecode });
    return this.normalizeGroup(data);
  }

  // ========== Communities ==========

  async createCommunity(name: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/community/create', { name });
  }

  async editCommunityGroups(
    communityId: string, action: 'add' | 'remove', groups: string[],
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/community/editgroups', {
      communityId, action, groups,
    });
  }

  // ========== Labels ==========

  async listLabels(): Promise<LabelInfo[]> {
    const data = await this.request<unknown>('GET', '/labels/list');
    if (Array.isArray(data)) return data as LabelInfo[];
    if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).labels)) {
      return (data as Record<string, unknown>).labels as LabelInfo[];
    }
    return [];
  }

  async createLabel(name: string, color?: number): Promise<LabelInfo> {
    return this.request<LabelInfo>('POST', '/labels/create', { name, color });
  }

  async updateLabel(id: string, name?: string, color?: number): Promise<LabelInfo> {
    return this.request<LabelInfo>('POST', '/labels/update', { id, name, color });
  }

  async deleteLabel(id: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/labels/delete', { id });
  }
}
