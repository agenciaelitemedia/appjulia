import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
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

// ============================================
// Context Creation
// ============================================

const WhatsAppDataContext = createContext<ChatContextValue | undefined>(undefined);

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
  
  // Audio metadata
  if (msg.message?.audioMessage) {
    metadata.is_ptt = msg.message.audioMessage.ptt;
    metadata.duration = msg.message.audioMessage.seconds;
    metadata.waveform = msg.message.audioMessage.waveform;
    metadata.mimetype = msg.message.audioMessage.mimetype;
  }
  
  // Image metadata
  if (msg.message?.imageMessage) {
    metadata.mimetype = msg.message.imageMessage.mimetype;
    metadata.thumbnail = msg.message.imageMessage.jpegThumbnail;
  }
  
  // Video metadata
  if (msg.message?.videoMessage) {
    metadata.mimetype = msg.message.videoMessage.mimetype;
    metadata.duration = msg.message.videoMessage.seconds;
    metadata.thumbnail = msg.message.videoMessage.jpegThumbnail;
  }
  
  // Document metadata
  if (msg.message?.documentMessage) {
    metadata.mimetype = msg.message.documentMessage.mimetype;
  }
  
  // Location metadata
  if (msg.message?.locationMessage) {
    metadata.latitude = msg.message.locationMessage.degreesLatitude;
    metadata.longitude = msg.message.locationMessage.degreesLongitude;
    metadata.location_name = msg.message.locationMessage.name;
    metadata.location_address = msg.message.locationMessage.address;
  }
  
  // Contact metadata
  if (msg.message?.contactMessage) {
    metadata.contact_name = msg.message.contactMessage.displayName;
  }
  
  // Reaction metadata
  if (msg.message?.reactionMessage) {
    metadata.reaction_emoji = msg.message.reactionMessage.text;
    metadata.reaction_target_id = msg.message.reactionMessage.key?.id;
  }
  
  // Sender info (for groups)
  if (msg.participant || msg.pushName) {
    metadata.sender_id = msg.participant;
    metadata.sender_name = msg.pushName;
  }
  
  // Quoted message
  if (msg.message?.extendedTextMessage?.contextInfo) {
    const ctx = msg.message.extendedTextMessage.contextInfo;
    if (ctx.stanzaId) {
      metadata.quoted_message = {
        id: ctx.stanzaId,
        from_me: false, // Will be determined later
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

  const clientId = user?.id ? String(user.id) : '';

  // ============================================
  // Load Contacts from Supabase
  // ============================================
  const loadContacts = useCallback(async (codAgent?: string) => {
    if (!clientId) return;
    
    setIsLoading(true);
    try {
      let query = supabase
        .from('chat_contacts')
        .select('*')
        .eq('client_id', clientId)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      
      if (codAgent) {
        query = query.eq('cod_agent', codAgent);
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
  }, [clientId]);

  // ============================================
  // Load Messages from Supabase + UaZapi
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
      // First try to load from Supabase cache
      const { data: cachedMessages, error: cacheError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('contact_id', contactId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (cacheError) throw cacheError;
      
      // If we have cached messages, use them
      if (cachedMessages && cachedMessages.length > 0) {
        const chatMessages = cachedMessages as ChatMessage[];
        
        setMessages(prev => ({
          ...prev,
          [contactId]: offset === 0 
            ? chatMessages.reverse()
            : [...(prev[contactId] || []), ...chatMessages.reverse()],
        }));
        
        return { messages: chatMessages, hasMore: cachedMessages.length === limit };
      }
      
      // If no cached messages and UaZapi is configured, fetch from API
      if (isConfigured && offset === 0) {
        const response = await message.find({
          number: contact.phone,
          limit,
          offset,
        });
        
        const apiMessages = (response.messages || []).map(msg =>
          convertUaZapiMessageToChatMessage(msg, contactId, clientId)
        );
        
        // Save to Supabase cache
        if (apiMessages.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await supabase.from('chat_messages').upsert(
            apiMessages.map(m => ({
              id: m.id,
              contact_id: m.contact_id,
              client_id: m.client_id,
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
            })) as any,
            { onConflict: 'message_id' }
          );
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
  }, [clientId, contacts, isConfigured, message]);

  // ============================================
  // Send Message
  // ============================================
  const sendMessage = useCallback(async (
    contactId: string,
    text: string,
    replyToId?: string
  ) => {
    if (!isConfigured) {
      toast.error('API não configurada');
      return;
    }
    
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    // Optimistic update
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
    
    setMessages(prev => ({
      ...prev,
      [contactId]: [...(prev[contactId] || []), tempMessage],
    }));
    
    try {
      const response = await message.sendText({
        number: contact.phone,
        text,
        quotedMessageId: replyToId,
      });
      
      // Update message with real ID and status
      setMessages(prev => ({
        ...prev,
        [contactId]: prev[contactId]?.map(m =>
          m.id === tempMessage.id
            ? { ...m, message_id: response.messageId, status: 'sent' as const }
            : m
        ) || [],
      }));
      
      // Save to Supabase
      await supabase.from('chat_messages').insert({
        id: tempMessage.id,
        contact_id: tempMessage.contact_id,
        client_id: tempMessage.client_id,
        text: tempMessage.text,
        type: tempMessage.type,
        from_me: tempMessage.from_me,
        status: 'sent',
        message_id: response.messageId,
        timestamp: tempMessage.timestamp,
        created_at: tempMessage.created_at,
      });
      
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
      
      // Mark as failed
      setMessages(prev => ({
        ...prev,
        [contactId]: prev[contactId]?.map(m =>
          m.id === tempMessage.id ? { ...m, status: 'failed' as const } : m
        ) || [],
      }));
    }
  }, [clientId, contacts, isConfigured, message]);

  // ============================================
  // Send Media
  // ============================================
  const sendMedia = useCallback(async (
    contactId: string,
    file: File,
    type: MessageType,
    caption?: string
  ) => {
    if (!isConfigured) {
      toast.error('API não configurada');
      return;
    }
    
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const sendFn = type === 'image' ? message.sendImage
        : type === 'video' ? message.sendVideo
        : type === 'audio' || type === 'ptt' ? message.sendAudio
        : message.sendDocument;
      
      await sendFn({
        number: contact.phone,
        mediaBase64: base64,
        mimetype: file.type,
        caption,
        fileName: file.name,
      });
      
      toast.success('Mídia enviada');
    } catch (error) {
      console.error('Error sending media:', error);
      toast.error('Erro ao enviar mídia');
    }
  }, [contacts, isConfigured, message]);

  // ============================================
  // Mark as Read
  // ============================================
  const markAsRead = useCallback(async (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || contact.unread_count === 0) return;
    
    try {
      if (isConfigured) {
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
  }, [contacts, isConfigured, chat]);

  // ============================================
  // Sync Contacts from UaZapi
  // ============================================
  const syncContacts = useCallback(async (codAgent?: string) => {
    if (!isConfigured || !clientId) {
      toast.error('API não configurada');
      return;
    }
    
    setIsSyncing(true);
    try {
      const response = await chat.find({
        limit: 100,
        sort: '-wa_lastMsgTimestamp',
      });
      
      const chats = response.chats || [];
      
      // Convert and upsert contacts
      const contactsToUpsert: Partial<ChatContact>[] = chats.map(c => ({
        client_id: clientId,
        cod_agent: codAgent,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabase.from('chat_contacts').upsert(contact as any, {
          onConflict: 'phone,client_id',
        });
      }
      
      await loadContacts(codAgent);
      toast.success('Contatos sincronizados');
    } catch (error) {
      console.error('Error syncing contacts:', error);
      toast.error('Erro ao sincronizar contatos');
    } finally {
      setIsSyncing(false);
    }
  }, [clientId, isConfigured, chat, loadContacts]);

  // ============================================
  // Computed Values
  // ============================================
  const selectedContact = useMemo(() => 
    contacts.find(c => c.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    
    // Filter by tab
    if (activeTab === 'individual') {
      filtered = filtered.filter(c => !c.is_group);
    } else if (activeTab === 'groups') {
      filtered = filtered.filter(c => c.is_group);
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query)
      );
    }
    
    return filtered;
  }, [contacts, activeTab, searchQuery]);

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
            setContacts(prev => [payload.new as ChatContact, ...prev]);
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
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as ChatMessage;
            // Avoid duplicates (optimistic updates)
            setMessages(prev => {
              const existing = prev[newMessage.contact_id] || [];
              const alreadyExists = existing.some(m => 
                m.id === newMessage.id || 
                (m.external_id && m.external_id === newMessage.external_id) ||
                (m.message_id && m.message_id === newMessage.message_id)
              );
              if (alreadyExists) return prev;
              return {
                ...prev,
                [newMessage.contact_id]: [...existing, newMessage],
              };
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ChatMessage;
            setMessages(prev => {
              const contactMsgs = prev[updated.contact_id];
              if (!contactMsgs) return prev;
              return {
                ...prev,
                [updated.contact_id]: contactMsgs.map(m =>
                  m.id === updated.id ? { ...m, ...updated } : m
                ),
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [clientId]);

  // ============================================
  // Context Value
  // ============================================
  const value = useMemo<ChatContextValue>(() => ({
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
  }), [
    contacts, messages, selectedContactId, activeTab, searchQuery, isLoading, isSyncing,
    loadContacts, loadMessages, sendMessage, sendMedia, markAsRead, syncContacts,
    selectedContact, filteredContacts, totalUnreadCount, individualUnreadCount, groupUnreadCount,
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

export function useWhatsAppData(): ChatContextValue {
  const context = useContext(WhatsAppDataContext);
  if (context === undefined) {
    throw new Error('useWhatsAppData must be used within a WhatsAppDataProvider');
  }
  return context;
}
