import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUaZapi } from '@/hooks/useUaZapi';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import type {
  ChatContact,
  ChatMessage,
  ChatContextValue,
  ChatTab,
  MessageType,
  UaZapiMessage,
  MessageMetadata,
} from '@/types/chat';
import type {
  ChatConversation,
  ConversationStatus,
  ConversationFilterStatus,
  ConversationHistoryEntry,
  ChatTag,
} from '@/types/conversation';

// ============================================
// Context Creation
// ============================================

export interface SelectedAgent {
  cod_agent: string;
  hub: 'uazapi' | 'waba';
  name?: string;
}

interface ExtendedContextValue extends ChatContextValue {
  selectedAgent: SelectedAgent | null;
  setSelectedAgent: (agent: SelectedAgent | null) => void;
  
  // Conversations
  conversations: ChatConversation[];
  selectedConversation: ChatConversation | null;
  conversationStatusFilter: ConversationFilterStatus;
  setConversationStatusFilter: (status: ConversationFilterStatus) => void;
  loadConversations: () => Promise<void>;
  getOrCreateConversation: (contactId: string) => Promise<ChatConversation | null>;
  updateConversationStatus: (conversationId: string, status: ConversationStatus, note?: string) => Promise<void>;
  assignConversation: (conversationId: string, assignedTo: string) => Promise<void>;
  
  // Tags
  tags: ChatTag[];
  loadTags: () => Promise<void>;
  addTagToConversation: (conversationId: string, tagId: string) => Promise<void>;
  removeTagFromConversation: (conversationId: string, tagId: string) => Promise<void>;
  createTag: (name: string, color: string) => Promise<ChatTag | null>;
  
  // Internal notes
  sendInternalNote: (contactId: string, text: string, senderName: string) => Promise<void>;
  
  // Contact detail panel
  showDetailPanel: boolean;
  setShowDetailPanel: (show: boolean) => void;
  
  // Conversation history
  conversationHistory: ConversationHistoryEntry[];
  loadConversationHistory: (conversationId: string) => Promise<void>;
}

const WhatsAppDataContext = createContext<ExtendedContextValue | undefined>(undefined);

// ============================================
// Helper Functions
// ============================================

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '').replace(/@.*/, '');
}

function parseMessageType(msg: UaZapiMessage): MessageType {
  if (msg.messageType) {
    const type = msg.messageType.toLowerCase();
    if (type.includes('image')) return 'image';
    if (type.includes('video')) return 'video';
    if (type.includes('audio') || type.includes('ptt')) return msg.message?.audioMessage?.ptt ? 'ptt' : 'audio';
    if (type.includes('document')) return 'document';
    if (type.includes('sticker')) return 'sticker';
    if (type.includes('location')) return 'location';
    if (type.includes('contact')) return 'contact';
    if (type.includes('reaction')) return 'reaction';
    if (type.includes('revoked') || type.includes('protocol')) return 'revoked';
  }
  
  if (msg.message) {
    if (msg.message.imageMessage) return 'image';
    if (msg.message.videoMessage) return 'video';
    if (msg.message.audioMessage) return msg.message.audioMessage.ptt ? 'ptt' : 'audio';
    if (msg.message.documentMessage) return 'document';
    if (msg.message.stickerMessage) return 'sticker';
    if (msg.message.locationMessage) return 'location';
    if (msg.message.contactMessage) return 'contact';
    if (msg.message.reactionMessage) return 'reaction';
    if (msg.message.protocolMessage) return 'revoked';
  }
  
  return 'text';
}

function extractMessageText(msg: UaZapiMessage): string | undefined {
  if (msg.text) return msg.text;
  if (msg.message?.conversation) return msg.message.conversation;
  if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;
  return undefined;
}

function extractMediaUrl(msg: UaZapiMessage): string | undefined {
  if (msg.fileURL) return msg.fileURL;
  if (msg.message?.imageMessage?.url) return msg.message.imageMessage.url;
  if (msg.message?.videoMessage?.url) return msg.message.videoMessage.url;
  if (msg.message?.audioMessage?.url) return msg.message.audioMessage.url;
  if (msg.message?.documentMessage?.url) return msg.message.documentMessage.url;
  if (msg.message?.stickerMessage?.url) return msg.message.stickerMessage.url;
  return undefined;
}

function extractMetadata(msg: UaZapiMessage): MessageMetadata {
  const metadata: MessageMetadata = {};
  
  if (msg.message?.audioMessage) {
    metadata.is_ptt = msg.message.audioMessage.ptt;
    metadata.duration = msg.message.audioMessage.seconds;
    metadata.waveform = msg.message.audioMessage.waveform;
    metadata.mimetype = msg.message.audioMessage.mimetype;
  }
  if (msg.message?.imageMessage) {
    metadata.mimetype = msg.message.imageMessage.mimetype;
    metadata.thumbnail = msg.message.imageMessage.jpegThumbnail;
  }
  if (msg.message?.videoMessage) {
    metadata.mimetype = msg.message.videoMessage.mimetype;
    metadata.duration = msg.message.videoMessage.seconds;
    metadata.thumbnail = msg.message.videoMessage.jpegThumbnail;
  }
  if (msg.message?.documentMessage) {
    metadata.mimetype = msg.message.documentMessage.mimetype;
  }
  if (msg.message?.locationMessage) {
    metadata.latitude = msg.message.locationMessage.degreesLatitude;
    metadata.longitude = msg.message.locationMessage.degreesLongitude;
    metadata.location_name = msg.message.locationMessage.name;
    metadata.location_address = msg.message.locationMessage.address;
  }
  if (msg.message?.contactMessage) {
    metadata.contact_name = msg.message.contactMessage.displayName;
  }
  if (msg.message?.reactionMessage) {
    metadata.reaction_emoji = msg.message.reactionMessage.text;
    metadata.reaction_target_id = msg.message.reactionMessage.key?.id;
  }
  if (msg.participant || msg.pushName) {
    metadata.sender_id = msg.participant;
    metadata.sender_name = msg.pushName;
  }
  if (msg.message?.extendedTextMessage?.contextInfo) {
    const ctx = msg.message.extendedTextMessage.contextInfo;
    if (ctx.stanzaId) {
      metadata.quoted_message = {
        id: ctx.stanzaId,
        from_me: false,
        sender_name: ctx.participant,
      };
    }
  }
  
  return metadata;
}

function convertUaZapiMessageToChatMessage(
  msg: UaZapiMessage,
  contactId: string,
  clientId: string
): ChatMessage {
  const messageId = msg.id || msg.messageId || msg.key?.id || crypto.randomUUID();
  const fromMe = msg.from_me ?? msg.fromMe ?? msg.key?.fromMe ?? false;
  const timestamp = msg.messageTimestamp || msg.timestamp;
  
  return {
    id: crypto.randomUUID(),
    contact_id: contactId,
    client_id: clientId,
    message_id: messageId,
    text: extractMessageText(msg),
    type: parseMessageType(msg),
    from_me: fromMe,
    status: 'sent',
    media_url: extractMediaUrl(msg),
    file_name: msg.message?.documentMessage?.fileName,
    caption: msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption,
    metadata: extractMetadata(msg),
    timestamp: timestamp 
      ? new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp).toISOString()
      : new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

// ============================================
// Provider Component
// ============================================

interface WhatsAppDataProviderProps {
  children: ReactNode;
}

export function WhatsAppDataProvider({ children }: WhatsAppDataProviderProps) {
  const { user } = useAuth();
  const { chat, message, isConfigured } = useUaZapi();
  
  // State
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChatTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SelectedAgent | null>(null);
  
  // Conversation state
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationStatusFilter, setConversationStatusFilter] = useState<ConversationFilterStatus>('all');
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [tags, setTags] = useState<ChatTag[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryEntry[]>([]);

  // Track known message IDs to prevent realtime duplicates
  const knownMessageIds = useRef<Set<string>>(new Set());

  const clientId = user?.id ? String(user.id) : '';
  const currentHub = selectedAgent?.hub || (isConfigured ? 'uazapi' : null);
  const currentCodAgent = selectedAgent?.cod_agent;

  // ============================================
  // Load Contacts from Supabase
  // ============================================
  const loadContacts = useCallback(async (codAgent?: string) => {
    if (!clientId) return;
    
    const agentFilter = codAgent || currentCodAgent;
    
    setIsLoading(true);
    try {
      let query = supabase
        .from('chat_contacts')
        .select('*')
        .eq('client_id', clientId)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      
      if (agentFilter) {
        query = query.eq('cod_agent', agentFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setContacts((data || []) as ChatContact[]);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Erro ao carregar contatos');
    } finally {
      setIsLoading(false);
    }
  }, [clientId, currentCodAgent]);

  // ============================================
  // Conversations
  // ============================================
  const loadConversations = useCallback(async () => {
    if (!clientId) return;
    
    try {
      let query = supabase
        .from('chat_conversations')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });
      
      if (currentCodAgent) {
        query = query.eq('cod_agent', currentCodAgent);
      }
      
      if (conversationStatusFilter !== 'all') {
        query = query.eq('status', conversationStatusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      setConversations((data || []) as ChatConversation[]);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }, [clientId, currentCodAgent, conversationStatusFilter]);

  const getOrCreateConversation = useCallback(async (contactId: string): Promise<ChatConversation | null> => {
    if (!clientId) return null;
    
    try {
      // Check for existing open conversation
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('contact_id', contactId)
        .eq('client_id', clientId)
        .in('status', ['pending', 'open'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (existing) return existing as ChatConversation;
      
      // Create new conversation
      const channel = currentHub === 'waba' ? 'whatsapp_waba' : 'whatsapp_uazapi';
      const { data: newConv, error } = await supabase
        .from('chat_conversations')
        .insert({
          contact_id: contactId,
          client_id: clientId,
          cod_agent: currentCodAgent,
          channel,
          status: 'open',
          priority: 'normal',
          protocol: '', // Will be auto-generated by trigger
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add to local state
      if (newConv) {
        const conv = newConv as ChatConversation;
        setConversations(prev => [conv, ...prev]);
        
        // Log history
        await supabase.from('chat_conversation_history').insert({
          conversation_id: conv.id,
          action: 'opened',
          actor_name: user?.name || 'Sistema',
          to_value: 'open',
        });
        
        return conv;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      return null;
    }
  }, [clientId, currentCodAgent, currentHub, user?.name]);

  const updateConversationStatus = useCallback(async (
    conversationId: string,
    status: ConversationStatus,
    note?: string
  ) => {
    try {
      const updates: Record<string, unknown> = { status };
      
      if (status === 'closed') {
        updates.closed_at = new Date().toISOString();
        if (note) updates.close_note = note;
      }
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }
      if (status === 'open') {
        // If reopening, clear close timestamps
        updates.closed_at = null;
        updates.resolved_at = null;
      }
      
      const { error } = await supabase
        .from('chat_conversations')
        .update(updates)
        .eq('id', conversationId);
      
      if (error) throw error;
      
      // Update local state
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, ...updates } as ChatConversation : c
      ));
      
      // Log history
      await supabase.from('chat_conversation_history').insert({
        conversation_id: conversationId,
        action: status === 'closed' ? 'closed' : status === 'resolved' ? 'resolved' : 'reopened',
        actor_name: user?.name || 'Sistema',
        to_value: status,
        notes: note,
      });
      
      toast.success(
        status === 'closed' ? 'Conversa encerrada' :
        status === 'resolved' ? 'Conversa resolvida' :
        'Conversa reaberta'
      );
    } catch (error) {
      console.error('Error updating conversation status:', error);
      toast.error('Erro ao atualizar status');
    }
  }, [user?.name]);

  const assignConversation = useCallback(async (conversationId: string, assignedTo: string) => {
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ assigned_to: assignedTo })
        .eq('id', conversationId);
      
      if (error) throw error;
      
      setConversations(prev => prev.map(c =>
        c.id === conversationId ? { ...c, assigned_to: assignedTo } : c
      ));
      
      await supabase.from('chat_conversation_history').insert({
        conversation_id: conversationId,
        action: 'assigned',
        actor_name: user?.name || 'Sistema',
        to_value: assignedTo,
      });
      
      toast.success('Conversa transferida');
    } catch (error) {
      console.error('Error assigning conversation:', error);
      toast.error('Erro ao transferir conversa');
    }
  }, [user?.name]);

  // ============================================
  // Tags
  // ============================================
  const loadTags = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from('chat_tags')
      .select('*')
      .eq('client_id', clientId);
    setTags((data || []) as ChatTag[]);
  }, [clientId]);

  const createTag = useCallback(async (name: string, color: string): Promise<ChatTag | null> => {
    if (!clientId) return null;
    const { data, error } = await supabase
      .from('chat_tags')
      .insert({ name, color, client_id: clientId })
      .select()
      .single();
    if (error) { toast.error('Erro ao criar tag'); return null; }
    const tag = data as ChatTag;
    setTags(prev => [...prev, tag]);
    return tag;
  }, [clientId]);

  const addTagToConversation = useCallback(async (conversationId: string, tagId: string) => {
    await supabase.from('chat_conversation_tags').insert({ conversation_id: conversationId, tag_id: tagId });
  }, []);

  const removeTagFromConversation = useCallback(async (conversationId: string, tagId: string) => {
    await supabase.from('chat_conversation_tags').delete().eq('conversation_id', conversationId).eq('tag_id', tagId);
  }, []);

  // ============================================
  // Conversation History
  // ============================================
  const loadConversationHistory = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from('chat_conversation_history')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });
    setConversationHistory((data || []) as ConversationHistoryEntry[]);
  }, []);

  // ============================================
  // Internal Notes
  // ============================================
  const sendInternalNote = useCallback(async (contactId: string, text: string, senderName: string) => {
    if (!clientId) return;
    
    const noteMessage: ChatMessage = {
      id: crypto.randomUUID(),
      contact_id: contactId,
      client_id: clientId,
      text,
      type: 'text',
      from_me: true,
      status: 'sent',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Save to DB with internal_note flag
    await supabase.from('chat_messages').insert({
      id: noteMessage.id,
      contact_id: contactId,
      client_id: clientId,
      text,
      type: 'text',
      from_me: true,
      status: 'sent',
      internal_note: true,
      sender_name: senderName,
      timestamp: noteMessage.timestamp,
    });

    // Add to local messages with metadata flag
    const noteWithMeta = {
      ...noteMessage,
      metadata: { ...noteMessage.metadata, internal_note: true, sender_name: senderName },
    };
    
    knownMessageIds.current.add(noteMessage.id);
    setMessages(prev => ({
      ...prev,
      [contactId]: [...(prev[contactId] || []), noteWithMeta],
    }));
  }, [clientId]);

  // ============================================
  // Load Messages from Supabase + API
  // ============================================
  const loadMessages = useCallback(async (
    contactId: string,
    limit = 50,
    offset = 0
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
    if (!clientId) return { messages: [], hasMore: false };
    
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return { messages: [], hasMore: false };
    
    try {
      const { data: cachedMessages, error: cacheError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('contact_id', contactId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (cacheError) throw cacheError;
      
      if (cachedMessages && cachedMessages.length > 0) {
        const chatMessages = cachedMessages.map((m: any) => ({
          ...m,
          metadata: {
            ...(m.metadata || {}),
            internal_note: m.internal_note,
            sender_name: m.sender_name || m.metadata?.sender_name,
          },
        })) as ChatMessage[];
        
        chatMessages.forEach(m => knownMessageIds.current.add(m.id));
        
        setMessages(prev => ({
          ...prev,
          [contactId]: offset === 0 
            ? chatMessages.reverse()
            : [...chatMessages.reverse(), ...(prev[contactId] || [])],
        }));
        
        return { messages: chatMessages, hasMore: cachedMessages.length === limit };
      }
      
      // If no cached messages and UaZapi is configured, fetch from API
      if (currentHub === 'uazapi' && isConfigured && offset === 0) {
        const response = await message.find({
          number: contact.phone,
          limit,
          offset,
        });
        
        const apiMessages = (response.messages || []).map(msg =>
          convertUaZapiMessageToChatMessage(msg, contactId, clientId)
        );
        
        if (apiMessages.length > 0) {
          for (const m of apiMessages) {
            await supabase.from('chat_messages').upsert({
              id: m.id,
              contact_id: m.contact_id,
              client_id: m.client_id,
              external_id: m.message_id,
              message_id: m.message_id,
              text: m.text,
              type: m.type,
              from_me: m.from_me,
              status: m.status,
              media_url: m.media_url,
              file_name: m.file_name,
              caption: m.caption,
              reply_to: m.reply_to,
              metadata: m.metadata as unknown as null,
              timestamp: m.timestamp,
              created_at: m.created_at,
            } as any, { onConflict: 'contact_id,external_id' });
          }
          
          apiMessages.forEach(m => knownMessageIds.current.add(m.id));
        }
        
        setMessages(prev => ({
          ...prev,
          [contactId]: apiMessages.reverse(),
        }));
        
        return { 
          messages: apiMessages, 
          hasMore: response.pagination?.hasMore || apiMessages.length === limit 
        };
      }
      
      return { messages: [], hasMore: false };
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Erro ao carregar mensagens');
      return { messages: [], hasMore: false };
    }
  }, [clientId, contacts, isConfigured, message, currentHub]);

  // ============================================
  // Send Message (Omnichannel)
  // ============================================
  const sendMessage = useCallback(async (
    contactId: string,
    text: string,
    replyToId?: string
  ) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    // Ensure conversation exists
    const conversation = await getOrCreateConversation(contactId);
    
    const tempMessage: ChatMessage = {
      id: crypto.randomUUID(),
      contact_id: contactId,
      client_id: clientId,
      text,
      type: 'text',
      from_me: true,
      status: 'sending',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    
    knownMessageIds.current.add(tempMessage.id);
    
    setMessages(prev => ({
      ...prev,
      [contactId]: [...(prev[contactId] || []), tempMessage],
    }));
    
    try {
      let externalMessageId: string | undefined;

      if (currentHub === 'waba' && currentCodAgent) {
        const { data, error } = await supabase.functions.invoke('waba-send', {
          body: {
            action: 'send_text',
            cod_agent: currentCodAgent,
            to: contact.phone,
            text,
          },
        });
        if (error) throw error;
        externalMessageId = data?.messageId || data?.messages?.[0]?.id;
      } else if (currentHub === 'uazapi' && isConfigured) {
        const response = await message.sendText({
          number: contact.phone,
          text,
          quotedMessageId: replyToId,
        });
        externalMessageId = response.messageId;
      } else {
        throw new Error('Nenhum provedor configurado para envio');
      }
      
      setMessages(prev => ({
        ...prev,
        [contactId]: prev[contactId]?.map(m =>
          m.id === tempMessage.id
            ? { ...m, message_id: externalMessageId, status: 'sent' as const }
            : m
        ) || [],
      }));
      
      // Save to Supabase with conversation_id
      await supabase.from('chat_messages').insert({
        id: tempMessage.id,
        contact_id: tempMessage.contact_id,
        client_id: tempMessage.client_id,
        text: tempMessage.text,
        type: tempMessage.type,
        from_me: tempMessage.from_me,
        status: 'sent',
        message_id: externalMessageId,
        external_id: externalMessageId,
        timestamp: tempMessage.timestamp,
        created_at: tempMessage.created_at,
        conversation_id: conversation?.id,
        sender_name: user?.name,
      });
      
      // Update first_response_at if this is the first agent response
      if (conversation && !conversation.first_response_at) {
        await supabase
          .from('chat_conversations')
          .update({ 
            first_response_at: new Date().toISOString(),
            status: 'open',
          })
          .eq('id', conversation.id);
      }
      
      // Update contact's last message
      await supabase
        .from('chat_contacts')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_text: text,
        })
        .eq('id', contactId);
        
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
      
      setMessages(prev => ({
        ...prev,
        [contactId]: prev[contactId]?.map(m =>
          m.id === tempMessage.id ? { ...m, status: 'failed' as const } : m
        ) || [],
      }));
    }
  }, [clientId, contacts, currentHub, currentCodAgent, isConfigured, message, getOrCreateConversation, user?.name]);

  // ============================================
  // Send Media (Omnichannel)
  // ============================================
  const sendMedia = useCallback(async (
    contactId: string,
    file: File,
    type: MessageType,
    caption?: string
  ) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    const conversation = await getOrCreateConversation(contactId);
    
    const previewUrl = URL.createObjectURL(file);
    const tempMessage: ChatMessage = {
      id: crypto.randomUUID(),
      contact_id: contactId,
      client_id: clientId,
      text: caption,
      type,
      from_me: true,
      status: 'sending',
      media_url: previewUrl,
      file_name: file.name,
      caption,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    
    knownMessageIds.current.add(tempMessage.id);
    
    setMessages(prev => ({
      ...prev,
      [contactId]: [...(prev[contactId] || []), tempMessage],
    }));
    
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload to Storage first
      let persistedUrl = previewUrl;
      try {
        const { data: uploadData } = await supabase.functions.invoke('chat-media-upload', {
          body: {
            base64,
            mimetype: file.type,
            fileName: file.name,
            contactId,
            clientId,
            source: 'outgoing',
          },
        });
        if (uploadData?.url) {
          persistedUrl = uploadData.url;
        }
      } catch (uploadErr) {
        console.warn('Media upload to storage failed, using preview URL:', uploadErr);
      }

      let externalMessageId: string | undefined;
      
      if (currentHub === 'waba' && currentCodAgent) {
        const { data, error } = await supabase.functions.invoke('waba-send', {
          body: {
            action: 'send_media',
            cod_agent: currentCodAgent,
            to: contact.phone,
            mediaBase64: base64,
            mimetype: file.type,
            type,
            caption,
            fileName: file.name,
          },
        });
        if (error) throw error;
        externalMessageId = data?.messageId || data?.messages?.[0]?.id;
      } else if (currentHub === 'uazapi' && isConfigured) {
        const sendFn = type === 'image' ? message.sendImage
          : type === 'video' ? message.sendVideo
          : type === 'audio' || type === 'ptt' ? message.sendAudio
          : message.sendDocument;
        
        const response = await sendFn({
          number: contact.phone,
          mediaBase64: base64,
          mimetype: file.type,
          caption,
          fileName: file.name,
        });
        externalMessageId = (response as any)?.messageId;
      } else {
        throw new Error('Nenhum provedor configurado para envio');
      }
      
      setMessages(prev => ({
        ...prev,
        [contactId]: prev[contactId]?.map(m =>
          m.id === tempMessage.id
            ? { ...m, message_id: externalMessageId, status: 'sent' as const, media_url: persistedUrl }
            : m
        ) || [],
      }));
      
      await supabase.from('chat_messages').insert({
        id: tempMessage.id,
        contact_id: tempMessage.contact_id,
        client_id: tempMessage.client_id,
        text: caption,
        type,
        from_me: true,
        status: 'sent',
        message_id: externalMessageId,
        external_id: externalMessageId,
        media_url: persistedUrl,
        file_name: file.name,
        caption,
        timestamp: tempMessage.timestamp,
        created_at: tempMessage.created_at,
        conversation_id: conversation?.id,
        sender_name: user?.name,
      });
      
      toast.success('Mídia enviada');
    } catch (error) {
      console.error('Error sending media:', error);
      toast.error('Erro ao enviar mídia');
      
      setMessages(prev => ({
        ...prev,
        [contactId]: prev[contactId]?.map(m =>
          m.id === tempMessage.id ? { ...m, status: 'failed' as const } : m
        ) || [],
      }));
    }
  }, [clientId, contacts, currentHub, currentCodAgent, isConfigured, message, getOrCreateConversation, user?.name]);

  // ============================================
  // Mark as Read
  // ============================================
  const markAsRead = useCallback(async (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || contact.unread_count === 0) return;
    
    try {
      if (currentHub === 'uazapi' && isConfigured) {
        await chat.markRead({ number: contact.phone, read: true });
      }
      
      await supabase
        .from('chat_contacts')
        .update({ unread_count: 0 })
        .eq('id', contactId);
      
      setContacts(prev =>
        prev.map(c => (c.id === contactId ? { ...c, unread_count: 0 } : c))
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [contacts, currentHub, isConfigured, chat]);

  // ============================================
  // Sync Contacts
  // ============================================
  const syncContacts = useCallback(async (codAgent?: string) => {
    const agentFilter = codAgent || currentCodAgent;
    
    if (currentHub === 'uazapi' && isConfigured) {
      setIsSyncing(true);
      try {
        const response = await chat.find({
          limit: 100,
          sort: '-wa_lastMsgTimestamp',
        });
        
        const chats = response.chats || [];
        
        const contactsToUpsert = chats.map((c: any) => ({
          client_id: clientId,
          cod_agent: agentFilter,
          phone: normalizePhone(c.phone || c.id || ''),
          name: c.wa_name || c.wa_contactName || c.lead_name || c.phone || 'Desconhecido',
          avatar: c.profilePictureUrl,
          is_group: c.wa_isGroup || false,
          is_archived: c.wa_archived || false,
          is_muted: (c.wa_muteEndTime || 0) > Date.now(),
          unread_count: c.wa_unreadCount || 0,
          last_message_at: c.wa_lastMsgTimestamp 
            ? new Date(c.wa_lastMsgTimestamp * 1000).toISOString()
            : null,
        }));
        
        for (const contact of contactsToUpsert) {
          await supabase.from('chat_contacts').upsert(contact as any, {
            onConflict: 'phone,client_id',
          });
        }
        
        await loadContacts(agentFilter);
        toast.success('Contatos sincronizados');
      } catch (error) {
        console.error('Error syncing contacts:', error);
        toast.error('Erro ao sincronizar contatos');
      } finally {
        setIsSyncing(false);
      }
    } else if (currentHub === 'waba') {
      setIsSyncing(true);
      try {
        await loadContacts(agentFilter);
        toast.success('Contatos atualizados');
      } finally {
        setIsSyncing(false);
      }
    } else {
      toast.error('Selecione um agente para sincronizar');
    }
  }, [clientId, currentHub, currentCodAgent, isConfigured, chat, loadContacts]);

  // ============================================
  // Computed Values
  // ============================================
  const selectedContact = useMemo(() => 
    contacts.find(c => c.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  const selectedConversation = useMemo(() => {
    if (!selectedContactId) return null;
    return conversations.find(c => c.contact_id === selectedContactId && ['pending', 'open'].includes(c.status)) || null;
  }, [conversations, selectedContactId]);

  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    
    if (activeTab === 'individual') {
      filtered = filtered.filter(c => !c.is_group);
    } else if (activeTab === 'groups') {
      filtered = filtered.filter(c => c.is_group);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query)
      );
    }
    
    // Filter by conversation status if not 'all'
    if (conversationStatusFilter !== 'all') {
      const contactIdsWithStatus = conversations
        .filter(c => c.status === conversationStatusFilter)
        .map(c => c.contact_id);
      filtered = filtered.filter(c => contactIdsWithStatus.includes(c.id));
    }
    
    return filtered;
  }, [contacts, activeTab, searchQuery, conversationStatusFilter, conversations]);

  const totalUnreadCount = useMemo(() =>
    contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [contacts]
  );

  const individualUnreadCount = useMemo(() =>
    contacts.filter(c => !c.is_group).reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [contacts]
  );

  const groupUnreadCount = useMemo(() =>
    contacts.filter(c => c.is_group).reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [contacts]
  );

  // ============================================
  // Realtime Subscriptions
  // ============================================
  useEffect(() => {
    if (!clientId) return;

    const contactsChannel = supabase
      .channel('chat_contacts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_contacts',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setContacts(prev => {
              const exists = prev.some(c => c.id === (payload.new as ChatContact).id);
              if (exists) return prev;
              return [payload.new as ChatContact, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setContacts(prev =>
              prev.map(c => (c.id === (payload.new as ChatContact).id ? payload.new as ChatContact : c))
            );
          } else if (payload.eventType === 'DELETE') {
            setContacts(prev => prev.filter(c => c.id !== (payload.old as ChatContact).id));
          }
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('chat_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          if (knownMessageIds.current.has(newMessage.id)) return;
          knownMessageIds.current.add(newMessage.id);
          
          // Enrich with internal_note metadata
          const enriched: ChatMessage = {
            ...newMessage,
            metadata: {
              ...(newMessage.metadata || {}),
              internal_note: newMessage.internal_note,
              sender_name: newMessage.sender_name || newMessage.metadata?.sender_name,
            },
          };
          
          setMessages(prev => {
            const existing = prev[enriched.contact_id] || [];
            const isDuplicate = existing.some(m => 
              m.id === enriched.id || 
              (m.message_id && enriched.message_id && m.message_id === enriched.message_id)
            );
            if (isDuplicate) return prev;
            
            return {
              ...prev,
              [enriched.contact_id]: [...existing, enriched],
            };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages(prev => ({
            ...prev,
            [updated.contact_id]: (prev[updated.contact_id] || []).map(m =>
              m.id === updated.id ? updated : m
            ),
          }));
        }
      )
      .subscribe();

    // Realtime for conversations
    const conversationsChannel = supabase
      .channel('chat_conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setConversations(prev => {
              const exists = prev.some(c => c.id === (payload.new as ChatConversation).id);
              if (exists) return prev;
              return [payload.new as ChatConversation, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setConversations(prev =>
              prev.map(c => (c.id === (payload.new as ChatConversation).id ? payload.new as ChatConversation : c))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [clientId]);

  // Reload contacts when agent changes
  useEffect(() => {
    if (currentCodAgent && clientId) {
      loadContacts(currentCodAgent);
      loadConversations();
      loadTags();
      setSelectedContactId(null);
      setMessages({});
      knownMessageIds.current.clear();
    }
  }, [currentCodAgent, clientId, loadContacts, loadConversations, loadTags]);

  // ============================================
  // Context Value
  // ============================================
  const value = useMemo<ExtendedContextValue>(() => ({
    // State
    contacts,
    messages,
    selectedContactId,
    activeTab,
    searchQuery,
    isLoading,
    isSyncing,
    
    // Actions
    loadContacts,
    loadMessages,
    sendMessage,
    sendMedia,
    markAsRead,
    syncContacts,
    selectContact: setSelectedContactId,
    setActiveTab,
    setSearchQuery,
    
    // Computed
    selectedContact,
    filteredContacts,
    totalUnreadCount,
    individualUnreadCount,
    groupUnreadCount,
    
    // Agent selection
    selectedAgent,
    setSelectedAgent,
    
    // Conversations
    conversations,
    selectedConversation,
    conversationStatusFilter,
    setConversationStatusFilter,
    loadConversations,
    getOrCreateConversation,
    updateConversationStatus,
    assignConversation,
    
    // Tags
    tags,
    loadTags,
    addTagToConversation,
    removeTagFromConversation,
    createTag,
    
    // Internal notes
    sendInternalNote,
    
    // Detail panel
    showDetailPanel,
    setShowDetailPanel,
    
    // Conversation history
    conversationHistory,
    loadConversationHistory,
  }), [
    contacts, messages, selectedContactId, activeTab, searchQuery, isLoading, isSyncing,
    loadContacts, loadMessages, sendMessage, sendMedia, markAsRead, syncContacts,
    selectedContact, filteredContacts, totalUnreadCount, individualUnreadCount, groupUnreadCount,
    selectedAgent, conversations, selectedConversation, conversationStatusFilter,
    loadConversations, getOrCreateConversation, updateConversationStatus, assignConversation,
    tags, loadTags, addTagToConversation, removeTagFromConversation, createTag,
    sendInternalNote, showDetailPanel, conversationHistory, loadConversationHistory,
  ]);

  return (
    <WhatsAppDataContext.Provider value={value}>
      {children}
    </WhatsAppDataContext.Provider>
  );
}

// ============================================
// Hook Export
// ============================================

export function useWhatsAppData() {
  const context = useContext(WhatsAppDataContext);
  if (context === undefined) {
    throw new Error('useWhatsAppData must be used within a WhatsAppDataProvider');
  }
  return context;
}
