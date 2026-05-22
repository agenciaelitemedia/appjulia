// ============================================
// Chat Types
// Types for the WhatsApp chat system
// ============================================

export type MessageType = 
  | 'text' 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'ptt' 
  | 'document' 
  | 'sticker' 
  | 'location' 
  | 'contact'
  | 'reaction'
  | 'revoked';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatContact {
  id: string;
  client_id: string;
  cod_agent?: string;
  channel_source?: string;
  channel_type?: string;
  remote_jid?: string;
  phone: string;
  name: string;
  avatar?: string;
  is_group: boolean;
  is_archived: boolean;
  is_muted: boolean;
  unread_count: number;
  last_message_at?: string;
  last_message_text?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  contact_id: string;
  client_id: string;
  message_id?: string;
  external_id?: string;
  text?: string;
  type: MessageType;
  from_me: boolean;
  status: MessageStatus;
  media_url?: string;
  file_name?: string;
  caption?: string;
  reply_to?: string;
  metadata?: MessageMetadata;
  internal_note?: boolean;
  conversation_id?: string;
  edited_at?: string;
  timestamp: string;
  created_at: string;
}

export interface MessageMetadata {
  // Quote/reply info
  quoted_message?: {
    id: string;
    text?: string;
    from_me: boolean;
    sender_name?: string;
    type?: MessageType;
  };
  
  // Media info
  mimetype?: string;
  file_size?: number;
  duration?: number;
  thumbnail?: string;
  
  // Location info
  latitude?: number;
  longitude?: number;
  location_name?: string;
  location_address?: string;
  
  // Contact info
  contact_name?: string;
  contact_phone?: string;
  
  // Reaction info
  reaction_emoji?: string;
  reaction_target_id?: string;
  
  // Audio specific
  is_ptt?: boolean;
  waveform?: number[];

  // AI transcription (audio/ptt)
  transcription?: {
    text?: string | null;
    status?: 'ok' | 'failed' | 'pending';
    reason?: string;
    model?: string;
    generated_at?: string;
  };
  
  // Sender info (for groups)
  sender_id?: string;
  sender_name?: string;
  sender_phone?: string;

  // Internal notes
  internal_note?: boolean;
  note_type?: 'info' | 'question' | 'urgent';
  conversation_id?: string;

  // Any extra fields
  [key: string]: unknown;
}

// ============================================
// API Request/Response Types
// ============================================

export interface FindMessagesRequest {
  number: string;
  limit?: number;
  offset?: number;
  fromMe?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface FindMessagesResponse {
  messages: UaZapiMessage[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Raw message from UaZapi API
export interface UaZapiMessage {
  id?: string;
  messageId?: string;
  key?: {
    id: string;
    fromMe: boolean;
    remoteJid: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
      contextInfo?: {
        quotedMessage?: unknown;
        stanzaId?: string;
        participant?: string;
      };
    };
    imageMessage?: {
      url?: string;
      caption?: string;
      mimetype?: string;
      fileLength?: string;
      jpegThumbnail?: string;
    };
    videoMessage?: {
      url?: string;
      caption?: string;
      mimetype?: string;
      fileLength?: string;
      seconds?: number;
      jpegThumbnail?: string;
    };
    audioMessage?: {
      url?: string;
      mimetype?: string;
      seconds?: number;
      ptt?: boolean;
      waveform?: number[];
    };
    documentMessage?: {
      url?: string;
      mimetype?: string;
      fileName?: string;
      fileLength?: string;
      jpegThumbnail?: string;
    };
    stickerMessage?: {
      url?: string;
      mimetype?: string;
    };
    locationMessage?: {
      degreesLatitude?: number;
      degreesLongitude?: number;
      name?: string;
      address?: string;
      jpegThumbnail?: string;
    };
    contactMessage?: {
      displayName?: string;
      vcard?: string;
    };
    reactionMessage?: {
      key?: {
        id: string;
      };
      text?: string;
    };
    protocolMessage?: {
      type?: number;
    };
  };
  messageType?: string;
  messageTimestamp?: number | string;
  pushName?: string;
  participant?: string;
  status?: string;
  // Baileys/UaZapi direct fields
  text?: string;
  fileURL?: string;
  base64?: string;
  from_me?: boolean;
  fromMe?: boolean;
  timestamp?: number | string;
  type?: string;
  [key: string]: unknown;
}

// ============================================
// Context Types
// ============================================

export type ChatTab = 'all' | 'individual' | 'groups';

export interface ChatState {
  contacts: ChatContact[];
  messages: Record<string, ChatMessage[]>;
  selectedContactId: string | null;
  activeTab: ChatTab;
  searchQuery: string;
  isLoading: boolean;
  isSyncing: boolean;
}

export interface ChatContextValue extends ChatState {
  // Actions
  loadContacts: (opts?: { reset?: boolean; append?: boolean }) => Promise<void>;
  loadMessages: (contactId: string, limit?: number, offset?: number) => Promise<{ messages: ChatMessage[]; hasMore: boolean }>;
  sendMessage: (contactId: string, text: string, replyToMessage?: ChatMessage) => Promise<void>;
  editMessage: (contactId: string, message: ChatMessage, newText: string) => Promise<void>;
  sendMedia: (contactId: string, file: File, type: MessageType, caption?: string) => Promise<void>;
  markAsRead: (contactId: string) => Promise<void>;
  syncContacts: (codAgent?: string) => Promise<void>;
  selectContact: (contactId: string | null) => void;
  setActiveTab: (tab: ChatTab) => void;
  setSearchQuery: (query: string) => void;
  
  // Computed
  selectedContact: ChatContact | null;
  filteredContacts: ChatContact[];
  totalUnreadCount: number;
  individualUnreadCount: number;
  groupUnreadCount: number;
}

// ============================================
// Utility Types
// ============================================

export interface MediaDownloadResult {
  url?: string;
  base64?: string;
  mimetype?: string;
  transcription?: string;
}

export interface SendMessageOptions {
  quotedMessageId?: string;
}

export interface SendMediaOptions {
  caption?: string;
  fileName?: string;
}
