import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import type {
  ChatContact,
  ChatMessage,
  ChatContextValue,
  ChatTab,
  MessageType,
} from '@/types/chat';
import type {
  ChatConversation,
  ConversationStatus,
  ConversationFilterStatus,
  ConversationHistoryEntry,
  ChatTag,
} from '@/types/conversation';
import { useQueues, type Queue } from '@/pages/agente/filas/hooks/useQueues';


// ============================================
// Types
// ============================================

export interface SelectedQueue {
  id: string;
  name: string;
  channel_type: string;
  hub: string | null;
  evo_url: string | null;
  evo_apikey: string | null;
  evo_instance: string | null;
}

interface ExtendedContextValue extends ChatContextValue {
  // Queue selection (replaces agent)
  selectedQueue: SelectedQueue | null;
  setSelectedQueue: (queue: SelectedQueue | null) => void;

  // Legacy compatibility alias
  selectedAgent: { cod_agent: string; hub: string; name?: string } | null;
  setSelectedAgent: (agent: any) => void;

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
  sendInternalNote: (
    contactId: string,
    text: string,
    senderName: string,
    options?: { team?: Array<{ id: number | string; name: string }>; byId?: string }
  ) => Promise<void>;

  // Contact detail panel
  showDetailPanel: boolean;
  setShowDetailPanel: (show: boolean) => void;

  // Conversation history
  conversationHistory: ConversationHistoryEntry[];
  loadConversationHistory: (conversationId: string) => Promise<void>;
}

const WhatsAppDataContext = createContext<ExtendedContextValue | undefined>(undefined);

// ============================================
// Provider Component
// ============================================

interface WhatsAppDataProviderProps {
  children: ReactNode;
}

export function WhatsAppDataProvider({ children }: WhatsAppDataProviderProps) {
  const { user } = useAuth();

  // State
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChatTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<SelectedQueue | null>(null);

  // Conversation state
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationStatusFilter, setConversationStatusFilter] = useState<ConversationFilterStatus>('all');
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [tags, setTags] = useState<ChatTag[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryEntry[]>([]);

  const knownMessageIds = useRef<Set<string>>(new Set());

  const clientId = user?.client_id ? String(user.client_id) : '';
  const currentQueueId = selectedQueue?.id;

  // Load all active queues for this client (used to resolve effective queue per-contact)
  const { data: allQueues = [] } = useQueues(false);

  // Resolve effective queue for a given contact:
  // 1) if a queue is selected globally, use it
  // 2) else, look up by contact.channel_source (= queue id)
  // 3) else, look up by active conversation.queue_id
  const getEffectiveQueue = useCallback((contactId: string): SelectedQueue | null => {
    if (selectedQueue) return selectedQueue;
    const contact = contacts.find(c => c.id === contactId);
    const conv = conversations.find(c => c.contact_id === contactId && ['pending', 'open'].includes(c.status));
    const queueId = contact?.channel_source || conv?.queue_id;
    if (!queueId) return null;
    const q = allQueues.find((x: Queue) => x.id === queueId);
    if (!q) return null;
    return {
      id: q.id,
      name: q.name,
      channel_type: q.channel_type,
      hub: q.hub,
      evo_url: q.evo_url,
      evo_apikey: q.evo_apikey,
      evo_instance: q.evo_instance,
    };
  }, [selectedQueue, contacts, conversations, allQueues]);

  // ============================================
  // Load Contacts from Supabase (filtered by queue via channel_source)
  // ============================================
  const loadContacts = useCallback(async () => {
    if (!clientId) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('chat_contacts')
        .select('*')
        .eq('client_id', clientId)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (currentQueueId) {
        query = query.eq('channel_source', currentQueueId);
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
  }, [clientId, currentQueueId]);

  // ============================================
  // Conversations (filtered by queue_id)
  // ============================================
  const loadConversations = useCallback(async () => {
    if (!clientId) return;

    try {
      let query = supabase
        .from('chat_conversations')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });

      if (currentQueueId) {
        query = query.eq('queue_id', currentQueueId);
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
  }, [clientId, currentQueueId, conversationStatusFilter]);

  const getOrCreateConversation = useCallback(async (contactId: string): Promise<ChatConversation | null> => {
    if (!clientId) return null;

    try {
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

      const channel = selectedQueue?.channel_type === 'waba' ? 'whatsapp_waba' : 'whatsapp_uazapi';
      const { data: newConv, error } = await supabase
        .from('chat_conversations')
        .insert({
          contact_id: contactId,
          client_id: clientId,
          queue_id: currentQueueId,
          channel,
          status: 'open',
          priority: 'normal',
          protocol: '',
        })
        .select()
        .single();

      if (error) throw error;

      if (newConv) {
        const conv = newConv as ChatConversation;
        setConversations(prev => [conv, ...prev]);

        await supabase.from('chat_conversation_history').insert({
          conversation_id: conv.id,
          action: 'opened',
          actor_name: user?.name || 'Sistema',
          to_value: 'open',
        });

        // Fire-and-forget automation engine
        supabase.functions.invoke('chat-automation-engine', {
          body: { event: 'conversation_created', conversation_id: conv.id, client_id: clientId },
        }).catch((err) => console.warn('automation engine error:', err));

        return conv;
      }

      return null;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      return null;
    }
  }, [clientId, currentQueueId, selectedQueue?.channel_type, user?.name]);

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
        updates.closed_at = null;
        updates.resolved_at = null;
      }

      const { error } = await supabase
        .from('chat_conversations')
        .update(updates)
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(c =>
        c.id === conversationId ? { ...c, ...updates } as ChatConversation : c
      ));

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

      // Fire webhooks + automation engine for resolved/closed
      if (status === 'resolved' || status === 'closed') {
        supabase.functions.invoke('chat-webhook-dispatcher', {
          body: {
            event: 'conversation_resolved',
            client_id: clientId,
            payload: { conversation_id: conversationId, status, note },
          },
        }).catch((err) => console.warn('webhook dispatcher error:', err));
      }
    } catch (error) {
      console.error('Error updating conversation status:', error);
      toast.error('Erro ao atualizar status');
    }
  }, [user?.name, clientId]);

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
  const sendInternalNote = useCallback(async (
    contactId: string,
    text: string,
    senderName: string,
    options?: { team?: Array<{ id: number | string; name: string }>; byId?: string }
  ) => {
    if (!clientId) return;

    const noteId = crypto.randomUUID();
    const noteMessage: ChatMessage = {
      id: noteId,
      contact_id: contactId,
      client_id: clientId,
      text,
      type: 'text',
      from_me: true,
      status: 'sent',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Resolve current conversation for this contact (for mention persistence)
    const conv = conversations.find(c => c.contact_id === contactId && ['pending', 'open'].includes(c.status));

    await supabase.from('chat_messages').insert({
      id: noteId,
      contact_id: contactId,
      client_id: clientId,
      conversation_id: conv?.id || null,
      text,
      type: 'text',
      from_me: true,
      status: 'sent',
      internal_note: true,
      sender_name: senderName,
      timestamp: noteMessage.timestamp,
    });

    // Persist @mentions if team list provided and we have a conversation
    if (conv && options?.team && options.team.length > 0) {
      try {
        const { persistMentionsFromNote } = await import('@/lib/chat/mentions');
        await persistMentionsFromNote({
          conversation_id: conv.id,
          message_id: noteId,
          text,
          team: options.team,
          by_id: options.byId,
          by_name: senderName,
        });
      } catch (e) {
        console.warn('[mentions] persist failed', e);
      }
    }

    const noteWithMeta = {
      ...noteMessage,
      metadata: { ...noteMessage.metadata, internal_note: true, sender_name: senderName },
    };

    knownMessageIds.current.add(noteId);
    setMessages(prev => ({
      ...prev,
      [contactId]: [...(prev[contactId] || []), noteWithMeta],
    }));
  }, [clientId, conversations]);

  // ============================================
  // Load Messages from Supabase
  // ============================================
  const loadMessages = useCallback(async (
    contactId: string,
    limit = 50,
    offset = 0
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
    console.log('[loadMessages] start', { contactId, limit, offset, clientId });

    try {
      const { data: cachedMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('contact_id', contactId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      console.log('[loadMessages] result', { contactId, count: cachedMessages?.length, error });

      if (error) throw error;

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

      return { messages: [], hasMore: false };
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Erro ao carregar mensagens');
      return { messages: [], hasMore: false };
    }
  }, [clientId]);

  // ============================================
  // Send Message via Edge Function (server-side proxy)
  // ============================================
  const sendMessage = useCallback(async (
    contactId: string,
    text: string,
    replyToId?: string
  ) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const queue = getEffectiveQueue(contactId);
    if (!queue) {
      toast.error('Sem fila ativa para este contato');
      return;
    }

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

      if (queue.channel_type === 'waba') {
        // WABA send via edge function
        const { data, error } = await supabase.functions.invoke('waba-send', {
          body: {
            action: 'send_text',
            queue_id: queue.id,
            to: contact.phone,
            text,
          },
        });
        if (error) throw error;
        externalMessageId = data?.messageId || data?.messages?.[0]?.id;
      } else {
        // UaZapi send via proxy with queue credentials
        const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
          body: {
            method: 'POST',
            endpoint: '/message/sendText',
            token: queue.evo_apikey,
            baseUrl: queue.evo_url,
            body: {
              number: contact.phone,
              text,
              quotedMessageId: replyToId,
            },
          },
        });
        if (error) throw error;
        const proxyData = data?.data || data;
        externalMessageId = proxyData?.messageId || proxyData?.id;
      }

      setMessages(prev => ({
        ...prev,
        [contactId]: prev[contactId]?.map(m =>
          m.id === tempMessage.id
            ? { ...m, message_id: externalMessageId, status: 'sent' as const }
            : m
        ) || [],
      }));

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

      if (conversation && !conversation.first_response_at) {
        await supabase
          .from('chat_conversations')
          .update({
            first_response_at: new Date().toISOString(),
            status: 'open',
          })
          .eq('id', conversation.id);
      }

      await supabase
        .from('chat_contacts')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_text: text,
        })
        .eq('id', contactId);

      // Update stage_entered_at on external CRM card
      if (contact.cod_agent && contact.phone) {
        try {
          const cleanNum = contact.phone.replace(/\D/g, '');
          await externalDb.raw({
            query: `UPDATE crm_atendimento_cards SET stage_entered_at = NOW(), updated_at = NOW() WHERE whatsapp_number = $1 AND cod_agent = $2`,
            params: [cleanNum, contact.cod_agent],
          });
        } catch (e) {
          console.warn('[Chat] Failed to update stage_entered_at:', e);
        }
      }

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
  }, [clientId, contacts, selectedQueue, getOrCreateConversation, user?.name]);

  // ============================================
  // Send Media via Edge Function
  // ============================================
  const sendMedia = useCallback(async (
    contactId: string,
    file: File,
    type: MessageType,
    caption?: string
  ) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || !selectedQueue) return;

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

      // Upload to Storage
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
        console.warn('Media upload to storage failed:', uploadErr);
      }

      let externalMessageId: string | undefined;

      if (selectedQueue.channel_type === 'waba') {
        const { data, error } = await supabase.functions.invoke('waba-send', {
          body: {
            action: 'send_media',
            queue_id: selectedQueue.id,
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
      } else {
        // UaZapi - determine endpoint by type
        const endpointMap: Record<string, string> = {
          image: '/message/sendImage',
          video: '/message/sendVideo',
          audio: '/message/sendAudio',
          ptt: '/message/sendAudio',
          document: '/message/sendDocument',
        };
        const path = endpointMap[type] || '/message/sendDocument';

        const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
          body: {
            method: 'POST',
            endpoint: path,
            token: selectedQueue.evo_apikey,
            baseUrl: selectedQueue.evo_url,
            body: {
              number: contact.phone,
              mediaBase64: base64,
              mimetype: file.type,
              caption,
              fileName: file.name,
            },
          },
        });
        if (error) throw error;
        const mediaProxyData = data?.data || data;
        externalMessageId = mediaProxyData?.messageId || mediaProxyData?.id;
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
  }, [clientId, contacts, selectedQueue, getOrCreateConversation, user?.name]);

  // ============================================
  // Mark as Read
  // ============================================
  const markAsRead = useCallback(async (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || contact.unread_count === 0) return;

    try {
      // Mark read on UaZapi server if queue is uazapi
      if (selectedQueue?.channel_type === 'uazapi' && selectedQueue.evo_apikey) {
        try {
          await supabase.functions.invoke('uazapi-proxy', {
            body: {
              method: 'POST',
              endpoint: '/chat/markRead',
              token: selectedQueue.evo_apikey,
              baseUrl: selectedQueue.evo_url,
              body: { number: contact.phone, read: true },
            },
          });
        } catch { /* ignore read errors */ }
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
  }, [contacts, selectedQueue]);

  // ============================================
  // Sync Contacts (pull from UaZapi API via proxy)
  // ============================================
  const syncContacts = useCallback(async () => {
    if (!selectedQueue || !clientId) {
      toast.error('Selecione uma fila para sincronizar');
      return;
    }

    setIsSyncing(true);
    try {
      if (selectedQueue.channel_type === 'uazapi') {
        const { data: response, error } = await supabase.functions.invoke('uazapi-proxy', {
          body: {
            method: 'POST',
            endpoint: '/chat/find',
            token: selectedQueue.evo_apikey,
            baseUrl: selectedQueue.evo_url,
            body: { limit: 100, sort: '-wa_lastMsgTimestamp' },
          },
        });
        if (error) throw error;

        const chats = response?.data?.chats || response?.data || [];

        for (const c of chats) {
          const phone = (c.phone || c.id || '').replace(/[^\d]/g, '').replace(/@.*/, '');
          if (!phone) continue;

          await supabase.from('chat_contacts').upsert({
            client_id: clientId,
            channel_source: selectedQueue.id,
            channel_type: 'whatsapp_uazapi',
            phone,
            name: c.wa_name || c.wa_contactName || c.lead_name || c.phone || 'Desconhecido',
            avatar: c.profilePictureUrl,
            is_group: c.wa_isGroup || false,
            is_archived: c.wa_archived || false,
            is_muted: (c.wa_muteEndTime || 0) > Date.now(),
            unread_count: c.wa_unreadCount || 0,
            last_message_at: (() => {
              if (!c.wa_lastMsgTimestamp) return null;
              const ts = Number(c.wa_lastMsgTimestamp);
              const msTs = ts > 1e12 ? ts : ts * 1000;
              const d = new Date(msTs);
              return (d.getFullYear() > 2000 && d.getFullYear() < 2100) ? d.toISOString() : null;
            })(),
            last_message_text: c.wa_lastMessage || c.wa_lastMessageContent || c.lastMessage || null,
          } as any, {
            onConflict: 'phone,client_id',
          });
        }
      }

      await loadContacts();
      toast.success('Contatos sincronizados');
    } catch (error) {
      console.error('Error syncing contacts:', error);
      toast.error('Erro ao sincronizar contatos');
    } finally {
      setIsSyncing(false);
    }
  }, [clientId, selectedQueue, loadContacts]);

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

    if (conversationStatusFilter !== 'all') {
      const contactIdsWithStatus = conversations
        .filter(c => c.status === conversationStatusFilter)
        .map(c => c.contact_id);
      filtered = filtered.filter(c => contactIdsWithStatus.includes(c.id));
    } else {
      // Hide snoozed conversations from the default list
      const now = Date.now();
      const snoozedContactIds = new Set(
        conversations
          .filter(c => {
            const conv = c as { snoozed_until?: string | null };
            return conv.snoozed_until && new Date(conv.snoozed_until).getTime() > now;
          })
          .map(c => c.contact_id)
      );
      filtered = filtered.filter(c => !snoozedContactIds.has(c.id));
    }

    // Always sort by most recent message (WhatsApp-style)
    filtered = [...filtered].sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });

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
            const newContact = payload.new as ChatContact;
            // Only add if matches current queue filter
            if (currentQueueId && newContact.channel_source !== currentQueueId) return;
            setContacts(prev => {
              if (prev.some(c => c.id === newContact.id)) return prev;
              return [newContact, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setContacts(prev => {
              const updated = prev.map(c => (c.id === (payload.new as ChatContact).id ? payload.new as ChatContact : c));
              // Re-sort by last_message_at so new messages bubble up
              return updated.sort((a, b) => {
                const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
                const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
                return bTime - aTime;
              });
            });
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

          // Hook automation + webhooks for inbound messages only
          if (!newMessage.from_me && !newMessage.internal_note) {
            supabase.functions.invoke('chat-automation-engine', {
              body: {
                event: 'message_received',
                conversation_id: newMessage.conversation_id,
                client_id: clientId,
                message_text: newMessage.text || '',
              },
            }).catch((err) => console.warn('automation engine error:', err));

            supabase.functions.invoke('chat-webhook-dispatcher', {
              body: {
                event: 'message_received',
                client_id: clientId,
                payload: {
                  message_id: newMessage.id,
                  conversation_id: newMessage.conversation_id,
                  contact_id: newMessage.contact_id,
                  text: newMessage.text,
                  type: newMessage.type,
                  timestamp: newMessage.timestamp,
                },
              },
            }).catch((err) => console.warn('webhook dispatcher error:', err));
          }
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
            const newConv = payload.new as ChatConversation;
            if (currentQueueId && newConv.queue_id !== currentQueueId) return;
            setConversations(prev => {
              if (prev.some(c => c.id === newConv.id)) return prev;
              return [newConv, ...prev];
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
  }, [clientId, currentQueueId]);

  // Reload when queue changes
  useEffect(() => {
    if (currentQueueId && clientId) {
      loadContacts();
      loadConversations();
      loadTags();
      setSelectedContactId(null);
      setMessages({});
      knownMessageIds.current.clear();
    }
  }, [currentQueueId, clientId, loadContacts, loadConversations, loadTags]);

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

    // Queue selection
    selectedQueue,
    setSelectedQueue,

    // Legacy compatibility (some components may still reference selectedAgent)
    selectedAgent: selectedQueue ? {
      cod_agent: selectedQueue.id,
      hub: selectedQueue.channel_type,
      name: selectedQueue.name,
    } : null,
    setSelectedAgent: () => {}, // no-op

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
    selectedQueue, conversations, selectedConversation, conversationStatusFilter,
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
