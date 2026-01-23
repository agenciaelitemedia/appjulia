// ============================================
// UaZapi API Types
// Based on OpenAPI specification v2.0
// ============================================

// ============================================
// Common Types
// ============================================

export interface ApiResponse<T = unknown> {
  response?: T;
  error?: string;
}

export interface PaginationInfo {
  totalRecords: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================
// Agent Types
// ============================================

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek';

export interface AgentConfig {
  id?: string;
  delete?: boolean;
  agent: {
    name: string;
    provider: AIProvider;
    apikey: string;
    model: string;
    basePrompt: string;
    temperature?: number;
    maxTokens?: number;
    diversityLevel?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    signMessages?: boolean;
    readMessages?: boolean;
    maxMessageLength?: number;
    typingDelay_seconds?: number;
    contextTimeWindow_hours?: number;
    contextMaxMessages?: number;
    contextMinMessages?: number;
  };
}

export interface AgentListItem {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  [key: string]: unknown;
}

// ============================================
// Business/Catalog Types
// ============================================

export interface CatalogProduct {
  id: string;
  name: string;
  description?: string;
  price?: string;
  currency?: string;
}

export interface BusinessCategory {
  id: string;
  localized_display_name: string;
}

export interface BusinessProfile {
  tag?: string;
  description?: string;
  address?: string;
  email?: string;
  websites?: string[];
  categories?: BusinessCategory[];
}

export interface UpdateProfileRequest {
  description?: string;
  address?: string;
  email?: string;
}

export interface UpdateProfileResponse {
  response: Record<string, unknown>;
  results: Record<string, unknown>;
  updated: number;
  failed: number;
}

// ============================================
// Call Types
// ============================================

export interface MakeCallRequest {
  number: string;
}

export interface RejectCallRequest {
  number?: string;
  id?: string;
}

// ============================================
// Chat Types
// ============================================

export interface ArchiveChatRequest {
  number: string;
  archive: boolean;
}

export interface BlockChatRequest {
  number: string;
  block: boolean;
}

export interface BlockListResponse {
  blockList: string[];
}

export interface CheckNumbersRequest {
  numbers: string[];
}

export interface CheckNumberResult {
  query: string;
  jid: string;
  lid?: string;
  isInWhatsapp: boolean;
  verifiedName?: string;
  groupName?: string;
  error?: string;
}

export interface DeleteChatRequest {
  number: string;
  deleteChatDB?: boolean;
  deleteMessagesDB?: boolean;
  deleteChatWhatsApp?: boolean;
}

export interface DeleteChatResponse {
  response: string;
  actions: string[];
  errors: string[];
}

export interface ChatDetailsRequest {
  number: string;
  preview?: boolean;
}

export interface ChatDetails {
  id: string;
  wa_fastid?: string;
  wa_chatid?: string;
  owner?: string;
  name?: string;
  phone?: string;
  wa_name?: string;
  wa_contactName?: string;
  wa_archived?: boolean;
  wa_isBlocked?: boolean;
  wa_isGroup?: boolean;
  wa_isGroup_admin?: boolean;
  wa_isGroup_announce?: boolean;
  wa_muteEndTime?: number;
  wa_isPinned?: boolean;
  wa_unreadCount?: number;
  wa_lastMsgTimestamp?: number;
  wa_label?: string;
  lead_name?: string;
  lead_fullName?: string;
  lead_email?: string;
  lead_personalid?: string;
  lead_status?: string;
  lead_notes?: string;
  lead_tags?: string[];
  lead_isTicketOpen?: boolean;
  lead_assignedAttendant_id?: string;
  lead_kanbanOrder?: number;
  lead_field01?: string;
  lead_field02?: string;
  lead_field03?: string;
  lead_field04?: string;
  lead_field05?: string;
  lead_field06?: string;
  lead_field07?: string;
  lead_field08?: string;
  lead_field09?: string;
  lead_field10?: string;
  lead_field11?: string;
  lead_field12?: string;
  lead_field13?: string;
  lead_field14?: string;
  lead_field15?: string;
  lead_field16?: string;
  lead_field17?: string;
  lead_field18?: string;
  lead_field19?: string;
  lead_field20?: string;
  chatbot_summary?: string;
  chatbot_lastTrigger_id?: string;
  chatbot_disableUntil?: number;
  profilePictureUrl?: string;
  [key: string]: unknown;
}

export interface EditLeadRequest {
  id: string;
  chatbot_disableUntil?: number;
  lead_isTicketOpen?: boolean;
  lead_assignedAttendant_id?: string;
  lead_kanbanOrder?: number;
  lead_tags?: string[];
  lead_name?: string;
  lead_fullName?: string;
  lead_email?: string;
  lead_personalid?: string;
  lead_status?: string;
  lead_notes?: string;
  lead_field01?: string;
  lead_field02?: string;
  lead_field03?: string;
  lead_field04?: string;
  lead_field05?: string;
  lead_field06?: string;
  lead_field07?: string;
  lead_field08?: string;
  lead_field09?: string;
  lead_field10?: string;
  lead_field11?: string;
  lead_field12?: string;
  lead_field13?: string;
  lead_field14?: string;
  lead_field15?: string;
  lead_field16?: string;
  lead_field17?: string;
  lead_field18?: string;
  lead_field19?: string;
  lead_field20?: string;
}

export interface FindChatsRequest {
  operator?: 'AND' | 'OR';
  sort?: string;
  limit?: number;
  offset?: number;
  wa_isGroup?: boolean;
  wa_archived?: boolean;
  wa_isBlocked?: boolean;
  wa_name?: string;
  lead_tags?: string;
  lead_isTicketOpen?: boolean;
  lead_assignedAttendant_id?: string;
  lead_status?: string;
  wa_label?: string;
  [key: string]: unknown;
}

export interface FindChatsResponse {
  chats: ChatDetails[];
  totalChatsStats: Record<string, unknown>;
  pagination: PaginationInfo;
}

export interface SetLabelsRequest {
  number: string;
  labelids?: string[];
  add_labelid?: string;
  remove_labelid?: string;
}

export interface SetLabelsResponse {
  response: string;
  editions: string[];
}

export interface MuteChatRequest {
  number: string;
  muteEndTime: number; // 0 = unmute, 8 = 8h, 168 = 1 week, -1 = forever
}

export interface PinChatRequest {
  number: string;
  pin: boolean;
}

export interface ReadChatRequest {
  number: string;
  read: boolean;
}

// ============================================
// Message Types
// ============================================

export interface SendTextRequest {
  number: string;
  text: string;
  quotedMessageId?: string;
}

export interface SendMediaRequest {
  number: string;
  mediaUrl?: string;
  mediaBase64?: string;
  mimetype?: string;
  caption?: string;
  fileName?: string;
}

export interface SendLocationRequest {
  number: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface SendContactRequest {
  number: string;
  contact: {
    name: string;
    phone: string;
  };
}

export interface SendButtonsRequest {
  number: string;
  text: string;
  buttons: Array<{
    id: string;
    text: string;
  }>;
  footer?: string;
}

export interface SendListRequest {
  number: string;
  text: string;
  buttonText: string;
  sections: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
  footer?: string;
}

export interface MessageResponse {
  response: string;
  messageId?: string;
}

// ============================================
// Group Types
// ============================================

export interface CreateCommunityRequest {
  name: string;
}

export interface CreateCommunityResponse {
  group: unknown;
  failed: string[];
}

export interface EditCommunityGroupsRequest {
  communityId: string;
  action: 'add' | 'remove';
  groups: string[];
}

export interface CreateGroupRequest {
  name: string;
  participants: string[];
}

export interface GroupInfo {
  id: string;
  subject: string;
  owner: string;
  creation: number;
  desc?: string;
  descId?: string;
  restrict?: boolean;
  announce?: boolean;
  size: number;
  participants: Array<{
    id: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  }>;
}

export interface UpdateGroupRequest {
  groupId: string;
  subject?: string;
  description?: string;
}

export interface GroupParticipantsRequest {
  groupId: string;
  participants: string[];
  action: 'add' | 'remove' | 'promote' | 'demote';
}

// ============================================
// Instance Types
// ============================================

export type InstanceStatus = 'disconnected' | 'connecting' | 'connected';

export interface InstanceInfo {
  status: InstanceStatus;
  phone?: string;
  name?: string;
  pushName?: string;
  profilePictureUrl?: string;
}

export interface QRCodeResponse {
  qrcode?: string;
  status: InstanceStatus;
}

// ============================================
// Labels Types
// ============================================

export interface Label {
  id: string;
  labelId?: string;
  name: string;
  color: number;
  predefinedId?: string;
}

export interface CreateLabelRequest {
  name: string;
  color?: number;
}

export interface UpdateLabelRequest {
  id: string;
  name?: string;
  color?: number;
}

// ============================================
// Chatwoot Types
// ============================================

export interface ChatwootConfig {
  chatwoot_enabled: boolean;
  chatwoot_url: string;
  chatwoot_account_id: number;
  chatwoot_inbox_id: number;
  chatwoot_access_token: string;
  chatwoot_ignore_groups: boolean;
  chatwoot_sign_messages: boolean;
  chatwoot_create_new_conversation: boolean;
}

export interface UpdateChatwootConfigRequest {
  enabled: boolean;
  url: string;
  access_token: string;
  account_id: number;
  inbox_id: number;
  ignore_groups?: boolean;
  sign_messages?: boolean;
  create_new_conversation?: boolean;
}

export interface UpdateChatwootConfigResponse {
  message: string;
  chatwoot_inbox_webhook_url: string;
}
