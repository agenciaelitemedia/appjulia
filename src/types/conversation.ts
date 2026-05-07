// ============================================
// Conversation (Ticket) Types
// Types for the omnichannel ticket system
// ============================================

export type ConversationChannel = 'whatsapp_uazapi' | 'whatsapp_waba' | 'webchat' | 'instagram';
export type ConversationStatus = 'pending' | 'open' | 'closed' | 'resolved';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ChatConversation {
  id: string;
  contact_id: string;
  client_id: string;
  cod_agent?: string;
  queue_id?: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  protocol: string;
  assigned_to?: string;
  department?: string;
  priority: ConversationPriority;
  tags: string[];
  opened_at: string;
  first_response_at?: string;
  closed_at?: string;
  resolved_at?: string;
  last_customer_message_at?: string | null;
  last_message_from_me?: boolean | null;
  close_reason?: string;
  close_note?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ConversationHistoryEntry {
  id: string;
  conversation_id: string;
  action: string;
  actor_name?: string;
  from_value?: string;
  to_value?: string;
  notes?: string;
  created_at: string;
}

export interface ChatTag {
  id: string;
  name: string;
  color: string;
  client_id: string;
  created_at: string;
}

export interface ChatDepartment {
  id: string;
  name: string;
  agents: string[];
  client_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Filters for conversation list
export type ConversationFilterStatus = 'all' | 'pending' | 'open' | 'closed' | 'resolved';

export interface ConversationFilters {
  status: ConversationFilterStatus;
  channel?: ConversationChannel;
  assignedTo?: string; // 'mine' | 'all' | specific id
  searchQuery: string;
}
