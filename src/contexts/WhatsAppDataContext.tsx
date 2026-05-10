import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { externalDb } from '@/lib/externalDb';
import { webmBlobToOggOpusStrict } from '@/lib/audio/webmToOgg';
import { getMessagePreview } from '@/lib/chat/messagePreview';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import type {
  ChatContact,
  ChatMessage,
  ChatContextValue,
  ChatTab,
  MessageType,
  MessageMetadata,
} from '@/types/chat';
import type {
  ChatConversation,
  ConversationStatus,
  ConversationFilterStatus,
  ConversationHistoryEntry,
  ChatTag,
} from '@/types/conversation';
import { useAccessibleQueues, type Queue } from '@/pages/agente/filas/hooks/useQueues';
import { startOfDay, subDays, startOfMonth, subMonths } from 'date-fns';

// Period filter (mirrors options shown in ChatList)
export type ChatPeriodFilter =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'thisMonth'
  | 'last3Months';

const CONTACTS_PAGE_SIZE = 50;
const CONVERSATIONS_PAGE_SIZE = 100;

// Lean column list for conversations — avoids transferring unused heavy columns
const CONV_COLUMNS = 'id,contact_id,client_id,queue_id,status,priority,assigned_to,cod_agent,updated_at,created_at,opened_at,first_response_at,resolved_at,closed_at,snoozed_until,channel,protocol,close_note'

// Reposition an existing contact in a list ordered by `last_message_at DESC`
// without re-sorting the entire array. O(n) instead of O(n log n).
function repositionContact(list: ChatContact[], updated: ChatContact): ChatContact[] {
  const idx = list.findIndex(c => c.id === updated.id);
  const next = idx >= 0 ? list.slice(0, idx).concat(list.slice(idx + 1)) : list.slice();
  const updatedTs = updated.last_message_at ? new Date(updated.last_message_at).getTime() : 0;
  let insertAt = next.length;
  for (let i = 0; i < next.length; i++) {
    const t = next[i].last_message_at ? new Date(next[i].last_message_at).getTime() : 0;
    if (updatedTs >= t) { insertAt = i; break; }
  }
  next.splice(insertAt, 0, updated);
  return next;
}

function getPeriodCutoffISO(p: ChatPeriodFilter): string | null {
  if (p === 'all') return null;
  const now = new Date();
  const todayStart = startOfDay(now);
  switch (p) {
    case 'today': return todayStart.toISOString();
    case 'yesterday': return subDays(todayStart, 1).toISOString();
    case 'last7days': return subDays(todayStart, 7).toISOString();
    case 'thisMonth': return startOfMonth(now).toISOString();
    case 'last3Months': return subMonths(todayStart, 3).toISOString();
    default: return null;
  }
}


// ============================================
// Media download — retry cache (module scope)
// ============================================
export type MediaDownloadStatus = 'idle' | 'loading' | 'success' | 'transient_failed' | 'permanent_failed';
export interface DownloadMediaResult {
  url?: string;
  transient?: boolean;
  permanent?: boolean;
}
const mediaRetryCache = new Map<string, { status: MediaDownloadStatus; lastAttempt: number; retryCount: number }>();
const TRANSIENT_BACKOFF_MS = 30_000;
const TRANSIENT_MAX_RETRIES = 3;

export function getMediaDownloadStatus(messageId: string): MediaDownloadStatus {
  return mediaRetryCache.get(messageId)?.status ?? 'idle';
}

export function canRetryMediaDownload(messageId: string, force = false): boolean {
  const entry = mediaRetryCache.get(messageId);
  if (!entry) return true;
  if (force) return true;
  if (entry.status === 'success') return false;
  if (entry.status === 'permanent_failed') return false;
  if (entry.status === 'loading') return false;
  if (entry.status === 'transient_failed') {
    if (entry.retryCount >= TRANSIENT_MAX_RETRIES) return false;
    if (Date.now() - entry.lastAttempt < TRANSIENT_BACKOFF_MS) return false;
  }
  return true;
}


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
  pendingConvCount: number;
  openConvCount: number;

  // Tags
  tags: ChatTag[];
  loadTags: () => Promise<void>;
  updateTag: (tagId: string, updates: { name?: string; color?: string }) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  addTagToConversation: (conversationId: string, tagId: string, tagName?: string) => Promise<void>;
  removeTagFromConversation: (conversationId: string, tagId: string, tagName?: string) => Promise<void>;
  createTag: (name: string, color: string) => Promise<ChatTag | null>;
  conversationTagsMap: Record<string, ChatTag[]>;
  refreshConversationTags: (conversationId?: string) => Promise<void>;

  // Internal notes
  sendInternalNote: (
    contactId: string,
    text: string,
    senderName: string,
    options?: {
      team?: Array<{ id: number | string; name: string }>;
      byId?: string;
      noteType?: 'info' | 'question' | 'urgent';
    }
  ) => Promise<void>;

  // Contact detail panel
  showDetailPanel: boolean;
  setShowDetailPanel: (show: boolean) => void;

  // Conversation history
  conversationHistory: ConversationHistoryEntry[];
  loadConversationHistory: (conversationId: string) => Promise<void>;

  // Media
  downloadMedia: (messageId: string) => Promise<DownloadMediaResult>;

  // Pagination of contacts list
  hasMoreContacts: boolean;
  isLoadingMoreContacts: boolean;
  loadMoreContacts: () => Promise<void>;

  // Pagination of conversations list
  hasMoreConversations: boolean;
  isLoadingMoreConversations: boolean;
  loadMoreConversations: () => Promise<void>;

  // Period filter (server-side cutoff for last_message_at)
  periodFilter: ChatPeriodFilter;
  setPeriodFilter: (p: ChatPeriodFilter) => void;

  // Sort order for contacts list (by last_message_at)
  sortOrder: 'newest' | 'oldest';
  setSortOrder: (o: 'newest' | 'oldest') => void;

  // Bootstrap readiness — true once client_id + queues + first conversations
  // page have all resolved at least once, so children can safely fetch
  // contact-scoped data (messages, history) without racing the bootstrap.
  isReady: boolean;

  // Hydration state for the currently selected contact.
  // True while we are fetching a contact row that is not yet in the local
  // `contacts` cache (e.g. when opening a contact via deep-link or via the
  // `useChatContactsByIds` overlay used by the chat list filters).
  isHydratingContact: boolean;
  // Last hydration error (if any) — used to render a fallback in the chat
  // panel instead of a permanently blank "Selecione uma conversa" placeholder.
  contactHydrationError: string | null;
  // Manually retry hydration for the currently selected contact.
  retryHydrateSelectedContact: () => void;
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

  // Max number of contact message lists kept in memory.
  // When exceeded, the oldest accessed entries (excluding the selected contact)
  // are evicted to prevent unbounded RAM growth during long sessions.
  const MESSAGES_LRU_MAX = 50;
  const messagesLruOrder = useRef<string[]>([]);

  // State
  const [effectiveClientId, setEffectiveClientId] = useState('');
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // LRU-aware wrapper around setMessages.
  // Tracks access order and evicts the oldest entries when the map exceeds
  // MESSAGES_LRU_MAX, skipping the currently selected contact so it is
  // never evicted mid-session.
  const setMessagesLru = useCallback(
    (updater: (prev: Record<string, ChatMessage[]>) => Record<string, ChatMessage[]>, touchedId?: string) => {
      setMessages(prev => {
        const next = updater(prev);
        if (touchedId) {
          // Move touched id to end (most recently used)
          messagesLruOrder.current = [
            ...messagesLruOrder.current.filter(id => id !== touchedId),
            touchedId,
          ];
        }
        const keys = Object.keys(next);
        if (keys.length <= MESSAGES_LRU_MAX) return next;
        // Evict oldest entries that are not the current selected contact
        const evict = messagesLruOrder.current
          .filter(id => id !== selectedContactId && id in next)
          .slice(0, keys.length - MESSAGES_LRU_MAX);
        if (evict.length === 0) return next;
        const trimmed = { ...next };
        evict.forEach(id => { delete trimmed[id]; });
        messagesLruOrder.current = messagesLruOrder.current.filter(id => !evict.includes(id));
        return trimmed;
      });
    },
    [selectedContactId]
  );

  const [isHydratingContact, setIsHydratingContact] = useState(false);
  const [contactHydrationError, setContactHydrationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChatTab>('individual');
  const [searchQuery, setSearchQuery] = useState('');
  // Start as loading so the chat list shows skeleton from the very first
  // render until `loadContacts({ reset: true })` finishes (or there is no
  // data to load). Avoids the flash of "Nenhuma conversa" on cold open.
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<SelectedQueue | null>(null);

  // Conversation state
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationStatusFilter, setConversationStatusFilter] = useState<ConversationFilterStatus>('pending');
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [tags, setTags] = useState<ChatTag[]>([]);
  const [conversationTagsMap, setConversationTagsMap] = useState<Record<string, ChatTag[]>>({});
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryEntry[]>([]);

  // Contacts pagination
  const [hasMoreContacts, setHasMoreContacts] = useState(true);
  const [isLoadingMoreContacts, setIsLoadingMoreContacts] = useState(false);

  // Conversations pagination
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);

  // Period filter — defaults to last 7 days every time the chat is opened
  const [periodFilter, setPeriodFilter] = useState<ChatPeriodFilter>('all');
  // Sort order for contacts list — newest first by default
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const knownMessageIds = useRef<Set<string>>(new Set());

  // Tracks whether the chat context has finished its initial bootstrap
  // (client id resolved, queues fetched, first conversations page loaded).
  // Children use this to avoid firing contact-scoped queries during the
  // brief window where the provider is still hydrating its scope.
  const [hasLoadedConversationsOnce, setHasLoadedConversationsOnce] = useState(false);

  const clientId = effectiveClientId;
  const currentQueueId = selectedQueue?.id;

  useEffect(() => {
    let cancelled = false;

    const resolveEffectiveClientId = async () => {
      if (!user?.id) {
        if (!cancelled) setEffectiveClientId('');
        return;
      }

      if (user.client_id) {
        if (!cancelled) setEffectiveClientId(String(user.client_id));
        return;
      }

      try {
        const inherited = await externalDb.getEffectiveClientId(Number(user.id));
        if (!cancelled) {
          setEffectiveClientId(inherited ? String(inherited) : '');
        }
      } catch (error) {
        console.warn('[WhatsAppDataContext] Failed to resolve effective client_id', error);
        if (!cancelled) setEffectiveClientId('');
      }
    };

    resolveEffectiveClientId();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.client_id]);

  // Load active queues for this client filtered by user access (queue_members)
  const { data: allQueues = [], isLoading: queuesLoading } = useAccessibleQueues(false);

  // Set of queue IDs that are still active (not soft-deleted) and accessible to this user.
  // Used to hide conversations/messages of deleted queues from Chat and CRM links.
  const activeQueueIds = useMemo(
    () => (allQueues as Queue[]).map(q => q.id),
    [allQueues]
  );

  // Resolve effective queue for a given contact — source of truth = the conversation itself.
  // The top-bar selectedQueue filter is for LISTING only; operations always use the contact's real queue.
  // Priority:
  // 1) Active conversation (in-memory) for this contact → queue_id
  // 2) Most recent conversation in DB with queue_id (any status)
  // 3) contact.channel_source
  // 4) Any active queue matching contact.channel_type
  // 5) Last resort: selectedQueue (only when contact is brand-new with no conversation)
  const buildSelectedQueue = useCallback((q: Queue | undefined | null): SelectedQueue | null => {
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
  }, []);

  const getEffectiveQueue = useCallback(async (contactId: string): Promise<SelectedQueue | null> => {
    // 1) in-memory active conversation
    const activeConv = conversations.find(
      c => c.contact_id === contactId && ['pending', 'open'].includes(c.status) && c.queue_id
    );
    if (activeConv?.queue_id) {
      const q = allQueues.find((x: Queue) => x.id === activeConv.queue_id);
      if (q) return buildSelectedQueue(q);
    }

    // 2) most recent conversation in DB with queue_id
    if (clientId) {
      try {
        const { data: priorConv } = await supabase
          .from('chat_conversations')
          .select('queue_id')
          .eq('contact_id', contactId)
          .eq('client_id', clientId)
          .not('queue_id', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (priorConv?.queue_id) {
          const q = allQueues.find((x: Queue) => x.id === priorConv.queue_id);
          if (q) return buildSelectedQueue(q);
        }
      } catch { /* fall through */ }
    }

    // 3) contact.channel_source
    const contact = contacts.find(c => c.id === contactId);
    if (contact?.channel_source) {
      const q = allQueues.find((x: Queue) => x.id === contact.channel_source);
      if (q) return buildSelectedQueue(q);
    }

    // 4) any active queue matching contact's channel_type
    if (contact?.channel_type) {
      const wantedChannel = contact.channel_type === 'whatsapp_waba' ? 'waba' : 'uazapi';
      const q = allQueues.find((x: Queue) => x.channel_type === wantedChannel);
      if (q) return buildSelectedQueue(q);
    }

    // 5) last resort
    return selectedQueue;
  }, [conversations, allQueues, contacts, clientId, selectedQueue, buildSelectedQueue]);

  // ============================================
  // Load Contacts from Supabase (filtered by queue via channel_source)
  // ============================================
  // Paginated loader. When `reset` is true (or omitted), the list is
  // replaced from offset 0; otherwise we append the next page.
  const loadContacts = useCallback(async (opts?: { reset?: boolean; append?: boolean }) => {
    // While the context is still resolving (no clientId yet, or queues
    // still loading), KEEP `isLoading=true` so the chat list keeps showing
    // skeletons instead of an empty state.
    if (!clientId || queuesLoading) {
      if (!opts?.append) setIsLoading(true);
      return;
    }
    const append = opts?.append === true;

    if (append) setIsLoadingMoreContacts(true);
    else setIsLoading(true);

    try {
      // Compute current offset from existing list when appending.
      // Read from a ref-snapshot via setContacts callback to avoid
      // depending on `contacts.length` (which would invalidate this
      // callback on every list update and thrash the reset effect).
      let offset = 0;
      if (append) {
        offset = await new Promise<number>((resolve) => {
          setContacts(prev => {
            resolve(prev.length);
            return prev;
          });
        });
      }

      let query = supabase
        .from('chat_contacts')
        // Lean column list — everything ChatContactItem and filters need.
        // Avoids fetching heavy/unused columns on every list refresh.
        .select('id,client_id,cod_agent,channel_source,channel_type,remote_jid,phone,name,avatar,is_group,is_archived,is_muted,unread_count,last_message_at,last_message_text,created_at,updated_at')
        .eq('client_id', clientId)
        .order('last_message_at', { ascending: sortOrder === 'oldest', nullsFirst: false })
        .range(offset, offset + CONTACTS_PAGE_SIZE - 1);

      if (currentQueueId) {
        query = query.eq('channel_source', currentQueueId);
      } else if (activeQueueIds.length > 0) {
        query = query.in('channel_source', activeQueueIds);
      } else if (queuesLoading) {
        return; // filas ainda carregando; não limpar a lista
      } else {
        if (!append) setContacts([]);
        setHasMoreContacts(false);
        return;
      }

      const cutoff = getPeriodCutoffISO(periodFilter);
      if (cutoff) {
        query = query.gte('last_message_at', cutoff);
      }

      const { data, error } = await query;
      if (error) throw error;

      const page = (data || []) as ChatContact[];
      setHasMoreContacts(page.length === CONTACTS_PAGE_SIZE);

      if (append) {
        setContacts(prev => {
          const seen = new Set(prev.map(c => c.id));
          const merged = [...prev];
          for (const c of page) if (!seen.has(c.id)) merged.push(c);
          return merged;
        });
      } else {
        setContacts(page);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Erro ao carregar contatos');
    } finally {
      if (append) setIsLoadingMoreContacts(false);
      else setIsLoading(false);
    }
  }, [clientId, currentQueueId, activeQueueIds, queuesLoading, periodFilter, sortOrder]);

  const loadMoreContacts = useCallback(async () => {
    if (isLoadingMoreContacts || !hasMoreContacts) return;
    await loadContacts({ append: true });
  }, [loadContacts, isLoadingMoreContacts, hasMoreContacts]);

  // ============================================
  // Conversations (filtered by queue_id)
  // ============================================
  // 'pending' and 'open' are grouped into one query so switching tabs never
  // re-fetches from the DB — the local state already has both.
  const convQueryGroup = conversationStatusFilter === 'resolved' ? 'resolved'
    : conversationStatusFilter === 'closed' ? 'closed'
    : 'active';

  // Mirror `convQueryGroup` into a ref so the realtime subscription handler
  // can read the latest filter without re-subscribing on every tab switch.
  const convQueryGroupRef = useRef(convQueryGroup);
  useEffect(() => {
    convQueryGroupRef.current = convQueryGroup;
  }, [convQueryGroup]);

  const loadConversations = useCallback(async (opts?: { append?: boolean }) => {
    if (!clientId || queuesLoading) return;
    const append = opts?.append === true;

    if (append) setIsLoadingMoreConversations(true);

    try {
      // Compute offset from current list when paginating
      let offset = 0;
      if (append) {
        offset = await new Promise<number>((resolve) => {
          setConversations(prev => {
            resolve(prev.length);
            return prev;
          });
        });
      }

      let query = supabase
        .from('chat_conversations')
        .select(CONV_COLUMNS)
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + CONVERSATIONS_PAGE_SIZE - 1);

      if (currentQueueId) query = query.eq('queue_id', currentQueueId);
      else if (activeQueueIds.length > 0) query = query.in('queue_id', activeQueueIds);
      else {
        if (!append) setConversations([]);
        setHasMoreConversations(false);
        return;
      }

      if (convQueryGroup === 'active') {
        query = query.in('status', ['pending', 'open']);
      } else {
        query = query.eq('status', convQueryGroup);
      }

      const { data, error } = await query;
      if (error) throw error;

      const page = ((data || []) as unknown) as ChatConversation[];
      setHasMoreConversations(page.length === CONVERSATIONS_PAGE_SIZE);

      if (append) {
        setConversations(prev => {
          const seen = new Set(prev.map(c => c.id));
          const merged = [...prev];
          for (const c of page) if (!seen.has(c.id)) merged.push(c);
          return merged;
        });
      } else {
        setConversations(page);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      if (!append) setHasLoadedConversationsOnce(true);
      if (append) setIsLoadingMoreConversations(false);
    }
  }, [clientId, currentQueueId, convQueryGroup, activeQueueIds, queuesLoading]);

  const loadMoreConversations = useCallback(async () => {
    if (isLoadingMoreConversations || !hasMoreConversations) return;
    await loadConversations({ append: true });
  }, [loadConversations, isLoadingMoreConversations, hasMoreConversations]);

  // Derived counts straight from in-memory `conversations` — no extra DB
  // round-trip. The realtime channel keeps `conversations` fresh, so these
  // counts react instantly to inserts/updates without re-querying.
  // NOTE: ChatList recomputes its own filtered counts; these are the
  // unfiltered totals exposed via context for backwards compatibility.
  const convCounts = useMemo(() => {
    let pending = 0, open = 0;
    for (const c of conversations) {
      // Conversa com responsável é classificada como "Em Atendimento" (open),
      // mesmo que o status físico ainda seja 'pending'.
      const hasAssignee = !!(c.assigned_to && String(c.assigned_to).trim() !== '');
      const effective = c.status === 'pending' && hasAssignee ? 'open' : c.status;
      if (effective === 'pending') pending++;
      else if (effective === 'open') open++;
    }
    return { pending, open };
  }, [conversations]);

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

      // If the existing conversation lives in a deleted queue, ignore it and
      // force creation of a new conversation in an active queue.
      const existingInActiveQueue = existing && existing.queue_id && activeQueueIds.includes(existing.queue_id);
      if (existingInActiveQueue) {
        const conv = existing as ChatConversation;
        setConversations(prev => prev.some(c => c.id === conv.id) ? prev : [conv, ...prev]);
        return conv;
      }

      // ── Resolve queue_id (every conversation MUST have a queue) ──
      // Priority: 1) prior conversation with queue_id, 2) contact.channel_source,
      // 3) any active queue matching channel_type, 4) selectedQueue (last resort)
      let resolvedQueueId: string | null = null;
      let resolvedChannelType: string | undefined;

      // 1) prior conversation with queue_id (any status)
      const { data: priorConv } = await supabase
        .from('chat_conversations')
        .select('queue_id, channel')
        .eq('contact_id', contactId)
        .eq('client_id', clientId)
        .not('queue_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (priorConv?.queue_id && activeQueueIds.includes(priorConv.queue_id)) {
        resolvedQueueId = priorConv.queue_id;
      }

      // 2) contact.channel_source — only if it is a UUID (queue id)
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let contactRow: { channel_source: string | null; channel_type: string | null } | null = null;
      if (!resolvedQueueId) {
        const { data } = await supabase
          .from('chat_contacts')
          .select('channel_source, channel_type')
          .eq('id', contactId)
          .maybeSingle();
        contactRow = data as any;
        if (contactRow?.channel_source && UUID_RE.test(contactRow.channel_source)) {
          resolvedQueueId = contactRow.channel_source;
        }
      }

      // 3) any active queue matching the contact's channel_type
      if (!resolvedQueueId && contactRow?.channel_type) {
        const wantedChannel = contactRow.channel_type === 'whatsapp_waba' ? 'waba' : 'uazapi';
        let queueQuery = supabase
          .from('queues')
          .select('id, channel_type, waba_number_id')
          .eq('client_id', clientId)
          .eq('channel_type', wantedChannel)
          .eq('is_active', true)
          .eq('is_deleted', false);
        // For WABA: prefer the queue whose waba_number_id matches the legacy phone_number_id stored in channel_source
        if (wantedChannel === 'waba' && contactRow.channel_source && !UUID_RE.test(contactRow.channel_source)) {
          queueQuery = queueQuery.eq('waba_number_id', contactRow.channel_source);
        }
        const { data: anyQueue } = await queueQuery
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (anyQueue?.id) {
          resolvedQueueId = anyQueue.id;
          resolvedChannelType = anyQueue.channel_type;
        }
      }

      // 4) last resort: globally selected queue (only for brand-new contacts)
      if (!resolvedQueueId && currentQueueId) {
        resolvedQueueId = currentQueueId;
        resolvedChannelType = selectedQueue?.channel_type;
      }

      if (!resolvedQueueId) {
        toast.error('Não foi possível identificar a fila para esta conversa. Selecione uma fila no topo.');
        return null;
      }

      const channel = resolvedChannelType === 'waba' ? 'whatsapp_waba' : 'whatsapp_uazapi';
      const { data: newConv, error } = await supabase
        .from('chat_conversations')
        .insert({
          contact_id: contactId,
          client_id: clientId,
          queue_id: resolvedQueueId,
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
  }, [clientId, currentQueueId, selectedQueue?.channel_type, user?.name, activeQueueIds]);

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

  const updateTag = useCallback(async (tagId: string, updates: { name?: string; color?: string }) => {
    const { error } = await supabase.from('chat_tags').update(updates).eq('id', tagId);
    if (error) { toast.error('Erro ao atualizar tag'); return; }
    setTags(prev => prev.map(t => t.id === tagId ? { ...t, ...updates } : t));
    setConversationTagsMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(convId => {
        next[convId] = next[convId].map(t => t.id === tagId ? { ...t, ...updates } : t);
      });
      return next;
    });
  }, []);

  const deleteTag = useCallback(async (tagId: string) => {
    const { error } = await supabase.from('chat_tags').delete().eq('id', tagId);
    if (error) { toast.error('Erro ao excluir tag'); return; }
    setTags(prev => prev.filter(t => t.id !== tagId));
    setConversationTagsMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(convId => {
        next[convId] = (next[convId] || []).filter(t => t.id !== tagId);
      });
      return next;
    });
  }, []);

  const refreshConversationTags = useCallback(async (conversationId?: string) => {
    if (!clientId) return;
    let query = supabase
      .from('chat_conversation_tags')
      .select('conversation_id, chat_tags:tag_id(id, name, color, client_id, created_at)')
      .eq('chat_tags.client_id', clientId);
    if (conversationId) query = query.eq('conversation_id', conversationId);
    const { data } = await query;
    if (conversationId) {
      const newTags: ChatTag[] = [];
      for (const row of data || []) {
        const tag = row.chat_tags as unknown as ChatTag;
        if (!tag?.id) continue;
        newTags.push(tag);
      }
      setConversationTagsMap(prev => ({ ...prev, [conversationId]: newTags }));
    } else {
      const map: Record<string, ChatTag[]> = {};
      for (const row of data || []) {
        const tag = row.chat_tags as unknown as ChatTag;
        if (!tag?.id) continue;
        if (!map[row.conversation_id]) map[row.conversation_id] = [];
        map[row.conversation_id].push(tag);
      }
      setConversationTagsMap(map);
    }
  }, [clientId]);

  const addTagToConversation = useCallback(async (conversationId: string, tagId: string, tagName?: string) => {
    await supabase.from('chat_conversation_tags').insert({ conversation_id: conversationId, tag_id: tagId });
    const tag = tags.find(t => t.id === tagId);
    const name = tagName || tag?.name || tagId;
    if (tag) {
      setConversationTagsMap(prev => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []).filter(t => t.id !== tagId), tag],
      }));
    }
    supabase.from('chat_conversation_history').insert({
      conversation_id: conversationId,
      action: 'tag_added',
      actor_name: user?.name || user?.email || 'Sistema',
      to_value: name,
    }).then();
  }, [tags, user]);

  const removeTagFromConversation = useCallback(async (conversationId: string, tagId: string, tagName?: string) => {
    await supabase.from('chat_conversation_tags').delete().eq('conversation_id', conversationId).eq('tag_id', tagId);
    const name = tagName || tags.find(t => t.id === tagId)?.name || tagId;
    setConversationTagsMap(prev => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).filter(t => t.id !== tagId),
    }));
    supabase.from('chat_conversation_history').insert({
      conversation_id: conversationId,
      action: 'tag_removed',
      actor_name: user?.name || user?.email || 'Sistema',
      to_value: name,
    }).then();
  }, [tags, user]);

  // ============================================
  // Conversation History
  // ============================================
  const loadConversationHistory = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from('chat_conversation_history')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(500);
    setConversationHistory((data || []) as ConversationHistoryEntry[]);
  }, []);

  // ============================================
  // Internal Notes
  // ============================================
  const sendInternalNote = useCallback(async (
    contactId: string,
    text: string,
    senderName: string,
    options?: {
      team?: Array<{ id: number | string; name: string }>;
      byId?: string;
      noteType?: 'info' | 'question' | 'urgent';
    }
  ) => {
    const noteType = options?.noteType || 'info';
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
      note_type: noteType,
      sender_name: senderName,
      timestamp: noteMessage.timestamp,
    } as any);

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
      metadata: { ...noteMessage.metadata, internal_note: true, sender_name: senderName, note_type: noteType },
    };

    knownMessageIds.current.add(noteId);
    setMessages(prev => ({
      ...prev,
      [contactId]: [...(prev[contactId] || []), noteWithMeta],
    }));

    if (conv?.id) {
      supabase.from('chat_conversation_history').insert({
        conversation_id: conv.id,
        action: 'note_added',
        actor_name: senderName || user?.name || user?.email || 'Sistema',
        notes: text,
      }).then();
    }
  }, [clientId, conversations, user]);

  // ============================================
  // Load Messages from Supabase
  // ============================================
  const loadMessages = useCallback(async (
    contactId: string,
    limit = 50,
    offset = 0
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
    try {
      const { data: cachedMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('contact_id', contactId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      if (cachedMessages && cachedMessages.length > 0) {
        const chatMessages = cachedMessages.map((m) => {
          const baseMeta = (m.metadata && typeof m.metadata === 'object' && !Array.isArray(m.metadata))
            ? (m.metadata as MessageMetadata)
            : ({} as MessageMetadata);
          return {
            ...m,
            metadata: {
              ...baseMeta,
              internal_note: m.internal_note,
              note_type: m.note_type,
              sender_name: m.sender_name || baseMeta?.sender_name,
            },
          };
        }) as ChatMessage[];

        chatMessages.forEach(m => knownMessageIds.current.add(m.id));

        const ordered = chatMessages.reverse();
        setMessagesLru(prev => {
          const existing = prev[contactId] || [];
          if (offset === 0) {
            // Merge dedupe by id — preserves any realtime messages that
            // arrived before the initial fetch finished.
            const seen = new Set(ordered.map(m => m.id));
            const realtimeOnly = existing.filter(m => !seen.has(m.id));
            return { ...prev, [contactId]: [...ordered, ...realtimeOnly] };
          }
          // Append older page above existing list, with dedupe.
          const existingIds = new Set(existing.map(m => m.id));
          const newOlder = ordered.filter(m => !existingIds.has(m.id));
          return { ...prev, [contactId]: [...newOlder, ...existing] };
        }, contactId);

        return { messages: chatMessages, hasMore: cachedMessages.length === limit };
      }

      // Empty result — make sure the bucket exists so the UI exits the
      // loading state with a deterministic empty list (instead of `undefined`).
      if (offset === 0) {
        setMessagesLru(prev => (prev[contactId] ? prev : { ...prev, [contactId]: [] }), contactId);
      }
      return { messages: [], hasMore: false };
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Erro ao carregar mensagens');
      return { messages: [], hasMore: false };
    }
  }, []);

  // ============================================
  // Send Message via Edge Function (server-side proxy)
  // ============================================
  const sendMessage = useCallback(async (
    contactId: string,
    text: string,
    replyToMessage?: ChatMessage
  ) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const queue = await getEffectiveQueue(contactId);
    if (!queue) {
      toast.error('Sem fila ativa para este contato');
      return;
    }

    const conversation = await getOrCreateConversation(contactId);

    const quotedMeta = replyToMessage ? {
      quoted_message: {
        id: replyToMessage.id,
        text: replyToMessage.text,
        from_me: replyToMessage.from_me,
        sender_name: replyToMessage.metadata?.sender_name ?? (replyToMessage.from_me ? (user?.name || 'Você') : undefined),
        type: replyToMessage.type,
      },
    } : undefined;

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
      ...(quotedMeta ? { metadata: quotedMeta } : {}),
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
        // Meta returns error in body even with HTTP 200 from edge function
        if (data?.error) {
          const metaErr = data.error?.error_user_msg
            || data.error?.message
            || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
          throw new Error(`WABA: ${metaErr}`);
        }
        externalMessageId = data?.messageId || data?.messages?.[0]?.id;
      } else {
        // UaZapi send via proxy with queue credentials
        const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
          body: {
            method: 'POST',
            endpoint: '/send/text',
            token: queue.evo_apikey,
            baseUrl: queue.evo_url,
            body: {
              number: contact.phone,
              text,
              quotedMessageId: replyToMessage?.message_id || replyToMessage?.external_id,
            },
          },
        });
        if (error) throw error;
        if (!data?.ok) {
          const upstream = data?.data;
          const msg = upstream?.message || upstream?.error || `UaZapi status ${data?.status}`;
          throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
        const proxyData = data?.data || {};
        externalMessageId = proxyData?.key?.id || proxyData?.id || proxyData?.messageId;
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
        reply_to: replyToMessage?.message_id || replyToMessage?.id || null,
        metadata: quotedMeta ?? null,
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
          last_message_text: getMessagePreview({ type: 'text', text }),
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
      const msg = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
      toast.error(msg);

      setMessages(prev => ({
        ...prev,
        [contactId]: prev[contactId]?.map(m =>
          m.id === tempMessage.id ? { ...m, status: 'failed' as const } : m
        ) || [],
      }));
    }
  }, [clientId, contacts, getEffectiveQueue, getOrCreateConversation, user?.name]);

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
    if (!contact) return;
    const queue = await getEffectiveQueue(contactId);
    if (!queue) {
      toast.error('Sem fila ativa para este contato');
      return;
    }

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
      const isAudioMessage = type === 'audio' || type === 'ptt';
      let outboundFile = file;

      // Meta requires a true OGG/Opus container for browser-recorded WebM audio.
      // UaZapi, on the other hand, handles the native WebM/Opus recording more reliably.
      if (queue.channel_type === 'waba' && isAudioMessage && (file.type || '').toLowerCase().includes('webm')) {
        let remux;
        try {
          remux = await webmBlobToOggOpusStrict(file);
        } catch (err) {
          console.error('[audio] WebM→OGG remux error:', err);
          throw new Error('Falha ao converter áudio para OGG/Opus para a API Oficial. Tente gravar novamente.');
        }
        const { blob: convertedBlob, packets, approxDurationMs } = remux;
        // Sanity-check the conversion: must be OGG, must have packets, must have plausible duration.
        const head = new Uint8Array(await convertedBlob.slice(0, 4).arrayBuffer());
        const isOgg = head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53;
        if (!isOgg) {
          throw new Error('Falha ao converter áudio para OGG/Opus para a API Oficial. Tente gravar novamente.');
        }
        // Reject obviously broken conversions: empty packets, sub-second audio, or
        // suspiciously small files (<2KB) which usually mean truncated streams.
        if (packets === 0 || (approxDurationMs >= 0 && approxDurationMs < 500) || convertedBlob.size < 2048) {
          console.error('[audio] remux produced suspicious output', { packets, approxDurationMs, size: convertedBlob.size });
          throw new Error('Áudio convertido ficou corrompido. Grave novamente — a API Oficial exige OGG/Opus íntegro.');
        }
        outboundFile = new File(
          [convertedBlob],
          file.name.replace(/\.[^.]+$/u, '') + '.ogg',
          { type: 'audio/ogg; codecs=opus' }
        );
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(outboundFile);
      });

      // Upload media for persistence / preview.
      // Storage rejects audio/webm — relabel as audio/ogg for storage only.
      // The actual bytes sent to UaZapi/WABA come from `outboundFile`, not from here.
      const storageMimetype = isAudioMessage && (outboundFile.type || '').toLowerCase().includes('webm')
        ? 'audio/ogg'
        : outboundFile.type;
      const storageFileName = isAudioMessage && (outboundFile.type || '').toLowerCase().includes('webm')
        ? outboundFile.name.replace(/\.[^.]+$/u, '') + '.ogg'
        : outboundFile.name;
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('chat-media-upload', {
        body: {
          base64,
          mimetype: storageMimetype,
          fileName: storageFileName,
          contactId,
          clientId,
          source: 'outgoing',
        },
      });
      if (uploadError) throw uploadError;
      if (!uploadData?.url) throw new Error('Falha no upload da mídia para o storage');
      const persistedUrl: string = uploadData.url;

      let externalMessageId: string | undefined;

      if (queue.channel_type === 'waba') {
        const { data, error } = await supabase.functions.invoke('waba-send', {
          body: {
            action: 'send_media',
            queue_id: queue.id,
            to: contact.phone,
            mediaBase64: base64,
            mimetype: outboundFile.type,
            type,
            caption,
            fileName: outboundFile.name,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'WABA media send failed');
        externalMessageId = data?.messageId || data?.messages?.[0]?.id;
      } else {
        // UaZapi: keep the browser-native audio format instead of forcing OGG.
        const mediaType = type === 'ptt' ? 'audio' : type;
        const sendMimetype = outboundFile.type || undefined;
        const fileField = isAudioMessage
          ? `data:${sendMimetype || 'audio/webm;codecs=opus'};base64,${base64}`
          : persistedUrl;
        const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
          body: {
            method: 'POST',
            endpoint: '/send/media',
            token: queue.evo_apikey,
            baseUrl: queue.evo_url,
            body: {
              number: contact.phone,
              file: fileField,
              mediaUrl: persistedUrl,
              type: mediaType,
              mediaType,
              mimetype: sendMimetype,
              caption,
              fileName: outboundFile.name,
              docName: type === 'document' ? outboundFile.name : undefined,
              ptt: type === 'ptt' ? true : undefined,
            },
          },
        });
        if (error) throw error;
        if (!data?.ok) {
          const upstream = data?.data;
          const msg = upstream?.message || upstream?.error || `UaZapi status ${data?.status}`;
          throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
        const mediaProxyData = data?.data || {};
        externalMessageId = mediaProxyData?.key?.id || mediaProxyData?.id || mediaProxyData?.messageId;
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

      const mediaPreview = getMessagePreview({ type, caption, file_name: file.name });
      await supabase
        .from('chat_contacts')
        .update({
          last_message_at: tempMessage.timestamp,
          last_message_text: mediaPreview,
        })
        .eq('id', contactId);

      setContacts(prev => prev.map(c =>
        c.id === contactId
          ? { ...c, last_message_text: mediaPreview, last_message_at: tempMessage.timestamp }
          : c
      ));

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
  }, [clientId, contacts, getEffectiveQueue, getOrCreateConversation, user?.name]);

  // ============================================
  // Download Media (decrypt UaZapi + persist)
  // ============================================
  const downloadMedia = useCallback(async (messageId: string): Promise<DownloadMediaResult> => {
    if (!messageId) return {};
    // Respect retry cache (skip when permanent or in backoff)
    if (!canRetryMediaDownload(messageId)) {
      const entry = mediaRetryCache.get(messageId);
      return {
        permanent: entry?.status === 'permanent_failed',
        transient: entry?.status === 'transient_failed',
      };
    }
    mediaRetryCache.set(messageId, {
      status: 'loading',
      lastAttempt: Date.now(),
      retryCount: (mediaRetryCache.get(messageId)?.retryCount ?? 0),
    });
    try {
      // Resolve the queue from the message's conversation (source of truth),
      // not from the UI's selected queue filter.
      let queueId: string | undefined;
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId);
        const q = supabase
          .from('chat_messages')
          .select('conversation_id, chat_conversations:conversation_id(queue_id)')
          .limit(1);
        const { data: msgRow } = await (isUuid
          ? q.eq('id', messageId).maybeSingle()
          : q.eq('message_id', messageId).maybeSingle());
        const convQueueId = (msgRow as any)?.chat_conversations?.queue_id;
        if (convQueueId) queueId = convQueueId;
      } catch { /* fall through */ }
      if (!queueId) queueId = selectedQueue?.id;
      let data: any = null;
      let error: any = null;
      const maxAttempts = 4;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const res = await supabase.functions.invoke('chat-media-download', {
          body: { messageId, queueId },
        });
        data = res.data;
        error = res.error;
        const msg = (error?.message || '') + ' ' + (data?.code || '');
        const isTransient = !!error &&
          /503|temporarily unavailable|SUPABASE_EDGE_RUNTIME_ERROR|Failed to fetch|NetworkError/i.test(msg);
        if (!isTransient) break;
        if (attempt === maxAttempts) break;
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
      if (error) throw error;
      const url: string | undefined = data?.url;
      if (!url) {
        const permanent = data?.permanent === true;
        const transient = data?.transient === true || (data?.fallback === true && !permanent);
        const prev = mediaRetryCache.get(messageId);
        mediaRetryCache.set(messageId, {
          status: permanent ? 'permanent_failed' : (transient ? 'transient_failed' : 'transient_failed'),
          lastAttempt: Date.now(),
          retryCount: (prev?.retryCount ?? 0) + 1,
        });
        return { transient, permanent };
      }
      // Update local state for any matching message
      setMessages(prev => {
        const next: Record<string, ChatMessage[]> = {};
        for (const [cid, list] of Object.entries(prev)) {
          next[cid] = list.map(m =>
            (m.id === messageId || m.message_id === messageId)
              ? { ...m, media_url: url }
              : m
          );
        }
        return next;
      });
      mediaRetryCache.set(messageId, { status: 'success', lastAttempt: Date.now(), retryCount: 0 });
      return { url };
    } catch (e) {
      console.error('[downloadMedia] failed:', e);
      const prev = mediaRetryCache.get(messageId);
      mediaRetryCache.set(messageId, {
        status: 'transient_failed',
        lastAttempt: Date.now(),
        retryCount: (prev?.retryCount ?? 0) + 1,
      });
      return { transient: true };
    }
  }, [selectedQueue?.id]);

  const markAsRead = useCallback(async (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || contact.unread_count === 0) return;

    try {
      const queue = await getEffectiveQueue(contactId);
      // Mark read on UaZapi server when applicable
      if (queue?.channel_type === 'uazapi' && queue.evo_apikey && queue.evo_url) {
        try {
          await supabase.functions.invoke('uazapi-proxy', {
            body: {
              method: 'POST',
              endpoint: '/chat/markRead',
              token: queue.evo_apikey,
              baseUrl: queue.evo_url,
              body: { number: contact.phone, read: true },
            },
          });
        } catch { /* ignore read errors */ }
      } else if (queue?.channel_type === 'whatsapp_waba' || queue?.channel_type === 'waba') {
        // Mark read on Meta Graph API using latest inbound wamid
        try {
          const { data: lastMsg } = await supabase
            .from('chat_messages')
            .select('message_id')
            .eq('contact_id', contactId)
            .eq('from_me', false)
            .not('message_id', 'is', null)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastMsg?.message_id) {
            await supabase.functions.invoke('waba-send', {
              body: {
                action: 'mark_read',
                queue_id: queue.id,
                message_id: lastMsg.message_id,
              },
            });
          }
        } catch { /* best-effort */ }
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
  }, [contacts, getEffectiveQueue]);

  // ============================================
  // Select Contact (no auto-assign — user must click "Assumir")
  // ============================================
  const selectContact = useCallback((contactId: string | null) => {
    setSelectedContactId(contactId);
    setContactHydrationError(null);
    if (!contactId) {
      setIsHydratingContact(false);
      return;
    }
    (async () => {
      try {
        let contact = contacts.find(c => c.id === contactId) || null;

        // A lista pode renderizar contatos buscados fora da página atual
        // (`useChatContactsByIds`) sem inseri-los no cache local `contacts`.
        // Ao clicar neles, o painel central dependia de `selectedContact`
        // vindo só desse cache e acabava ficando no estado vazio.
        if (!contact) {
          setIsHydratingContact(true);
          const { data: fetchedContact, error } = await supabase
            .from('chat_contacts')
            .select('id,client_id,cod_agent,channel_source,channel_type,remote_jid,phone,name,avatar,is_group,is_archived,is_muted,unread_count,last_message_at,last_message_text,created_at,updated_at')
            .eq('id', contactId)
            .maybeSingle();

          if (error) throw error;

          if (fetchedContact) {
            contact = fetchedContact as ChatContact;
            setContacts(prev => {
              const alreadyExists = prev.some(c => c.id === contactId);
              if (alreadyExists) {
                return prev.map(c => (c.id === contactId ? contact! : c));
              }
              return repositionContact(prev, contact!);
            });
          } else {
            setContactHydrationError('Contato não encontrado.');
          }
        }

        // Resolve existing conversation in memory first.
        const existingConv = conversations.find(c => c.contact_id === contactId);
        if (existingConv && ['resolved', 'closed'].includes(existingConv.status)) {
          // Read-only view — do not reopen / create.
          return;
        }
        if (existingConv && ['pending', 'open'].includes(existingConv.status)) {
          // Already have an active conversation — skip the DB round-trip.
          // The realtime subscription keeps it fresh.
        } else {
          // No active conversation yet — create one in the background.
          // Don't block UI on this; messages already load in parallel.
          getOrCreateConversation(contactId).catch((err) =>
            console.warn('[selectContact] getOrCreateConversation', err)
          );
        }

        if (!contact || contact.unread_count === 0) return;

        // Mark as read on click for all conversations
        markAsRead(contactId).catch(() => { /* best-effort */ });
      } catch (e) {
        console.warn('[selectContact] error', e);
        setContactHydrationError(
          e instanceof Error ? e.message : 'Erro ao carregar a conversa.'
        );
      } finally {
        setIsHydratingContact(false);
      }
    })();
  }, [getOrCreateConversation, contacts, conversations, markAsRead, user?.name, user?.id]);

  const retryHydrateSelectedContact = useCallback(() => {
    if (selectedContactId) selectContact(selectedContactId);
  }, [selectContact, selectedContactId]);

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
    // Priority: active first, then resolved/closed for read-only view
    return conversations.find(c => c.contact_id === selectedContactId && ['pending', 'open'].includes(c.status))
      || conversations.find(c => c.contact_id === selectedContactId && ['resolved', 'closed'].includes(c.status))
      || null;
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
        .filter(c => {
          const hasAssignee = !!(c.assigned_to && String(c.assigned_to).trim() !== '');
          const effective = c.status === 'pending' && hasAssignee ? 'open' : c.status;
          return effective === conversationStatusFilter;
        })
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

    // When a specific queue is selected, filter Realtime at the server level
    // to that queue only — reduces broadcast volume by ~60-80% per agent.
    // When viewing "Todas", fall back to client_id (JS-side filtering still applies).
    const contactsFilter = currentQueueId
      ? `channel_source=eq.${currentQueueId}`
      : `client_id=eq.${clientId}`;

    const contactsChannel = supabase
      .channel(`chat_contacts_changes_${currentQueueId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_contacts',
          filter: contactsFilter,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newContact = payload.new as ChatContact;
            // Only add if matches current queue filter
            if (currentQueueId && newContact.channel_source !== currentQueueId) return;
            // When viewing "Todas", restrict to queues the user has access to
            if (!currentQueueId && newContact.channel_source && !activeQueueIds.includes(newContact.channel_source)) return;
            setContacts(prev => {
              if (prev.some(c => c.id === newContact.id)) return prev;
              return [newContact, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updContact = payload.new as ChatContact;
            if (currentQueueId && updContact.channel_source !== currentQueueId) {
              setContacts(prev => prev.filter(c => c.id !== updContact.id));
              return;
            }
            if (!currentQueueId && updContact.channel_source && !activeQueueIds.includes(updContact.channel_source)) {
              setContacts(prev => prev.filter(c => c.id !== updContact.id));
              return;
            }
            setContacts(prev => {
              // Reposition the single updated contact in O(n) instead of
              // re-sorting the whole list on every realtime UPDATE.
              if (!prev.some(c => c.id === updContact.id)) return prev;
              return repositionContact(prev, updContact);
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
              note_type: (newMessage as any).note_type,
              sender_name: newMessage.sender_name || newMessage.metadata?.sender_name,
            },
          };

          let wasDuplicate = false;
          setMessagesLru(prev => {
            const existing = prev[enriched.contact_id] || [];
            const isDuplicate = existing.some(m =>
              m.id === enriched.id ||
              (m.message_id && enriched.message_id && m.message_id === enriched.message_id)
            );
            if (isDuplicate) {
              wasDuplicate = true;
              return prev;
            }

            return {
              ...prev,
              [enriched.contact_id]: [...existing, enriched],
            };
          }, enriched.contact_id);

          // For outbound from_me messages received via realtime (sent from another device):
          // update last_message_text in-memory so the preview reflects the sent media.
          if (!wasDuplicate && newMessage.from_me && !newMessage.internal_note) {
            const previewOut = getMessagePreview({
              type: newMessage.type,
              text: newMessage.text,
              caption: newMessage.caption,
              file_name: newMessage.file_name,
            });
            setContacts(prev => prev.map(c =>
              c.id === newMessage.contact_id
                ? {
                    ...c,
                    last_message_text: previewOut || c.last_message_text,
                    last_message_at: newMessage.timestamp || newMessage.created_at || c.last_message_at,
                  }
                : c
            ));
            setContacts(prev => {
              const target = prev.find(c => c.id === newMessage.contact_id);
              return target ? repositionContact(prev, target) : prev;
            });
          }

          // For inbound (not from me, not internal note): bump unread_count locally
          // and persist to DB so the badge appears immediately. We do NOT skip when
          // the conversation is open — the badge must remain visible until the agent
          // explicitly assumes the conversation (which calls markAsRead).
          if (!wasDuplicate && !newMessage.from_me && !newMessage.internal_note) {
            const previewIn = getMessagePreview({
              type: newMessage.type,
              text: newMessage.text,
              caption: newMessage.caption,
              file_name: newMessage.file_name,
            });
            setContacts(prev => prev.map(c =>
              c.id === newMessage.contact_id
                ? {
                    ...c,
                    unread_count: (c.unread_count || 0) + 1,
                    last_message_text: previewIn || c.last_message_text,
                    last_message_at: newMessage.timestamp || newMessage.created_at || c.last_message_at,
                  }
                : c
            ));
            setContacts(prev => {
              const target = prev.find(c => c.id === newMessage.contact_id);
              return target ? repositionContact(prev, target) : prev;
            });

            // Persist to DB (best-effort) so other clients/refresh see the badge
            (async () => {
              try {
                const { data: current } = await supabase
                  .from('chat_contacts')
                  .select('unread_count')
                  .eq('id', newMessage.contact_id)
                  .single();
                const next = (current?.unread_count || 0) + 1;
                await supabase
                  .from('chat_contacts')
                  .update({
                    unread_count: next,
                    last_message_text: previewIn || null,
                    last_message_at: newMessage.timestamp || newMessage.created_at || new Date().toISOString(),
                  })
                  .eq('id', newMessage.contact_id);
              } catch (e) {
                console.warn('failed to bump unread_count:', e);
              }
            })();
          }

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

    const conversationsFilter = currentQueueId
      ? `queue_id=eq.${currentQueueId}`
      : `client_id=eq.${clientId}`;

    const conversationsChannel = supabase
      .channel(`chat_conversations_changes_${currentQueueId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
          filter: conversationsFilter,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newConv = payload.new as ChatConversation;
            if (currentQueueId && newConv.queue_id !== currentQueueId) return;
            // Hide conversations of soft-deleted queues
            if (!currentQueueId && newConv.queue_id && !activeQueueIds.includes(newConv.queue_id)) return;
            setConversations(prev => {
              if (prev.some(c => c.id === newConv.id)) return prev;
              return [newConv, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updConv = payload.new as ChatConversation;
            if (!currentQueueId && updConv.queue_id && !activeQueueIds.includes(updConv.queue_id)) {
              // Drop from local state if the queue became deleted
              setConversations(prev => prev.filter(c => c.id !== updConv.id));
              return;
            }
            // Queue scope check
            if (currentQueueId && updConv.queue_id !== currentQueueId) {
              setConversations(prev => prev.filter(c => c.id !== updConv.id));
              return;
            }
            // Status scope check vs the currently loaded group (active / resolved / closed).
            // This is what makes a "resolved → open" reopen show up immediately in the
            // "Em aberto" tab, and a "open → resolved" disappear from it without reload.
            const group = convQueryGroupRef.current;
            const matchesGroup =
              group === 'active'
                ? (updConv.status === 'pending' || updConv.status === 'open')
                : updConv.status === group;
            if (!matchesGroup) {
              setConversations(prev => prev.filter(c => c.id !== updConv.id));
              return;
            }
            // Upsert: replace if present, otherwise insert at the top (sorted by updated_at desc).
            setConversations(prev => {
              const idx = prev.findIndex(c => c.id === updConv.id);
              if (idx >= 0) {
                const next = prev.slice();
                next[idx] = updConv;
                return next;
              }
              return [updConv, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [clientId, currentQueueId, activeQueueIds]);

  // Reload everything and clear selection when queue or client changes
  // - Initial bootstrap: just load — never wipe selection.
  // - Real scope change (queue / client / period): wipe selection + cache.
  // - `activeQueueIds` reference change alone (e.g. queues list re-fetch with
  //   the same set) must NOT clear the selected conversation. We compare its
  //   contents instead of relying on referential identity.
  const bootstrapKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!clientId || queuesLoading) return;
    const key = JSON.stringify({
      clientId,
      queueId: currentQueueId || null,
      period: periodFilter,
      sortOrder,
      // Sorted active queues so reorderings don't trigger a reset.
      queues: [...activeQueueIds].sort(),
    });
    const prev = bootstrapKeyRef.current;
    bootstrapKeyRef.current = key;
    setHasMoreContacts(true);
    setHasMoreConversations(false);
    // Fire all 4 bootstrap requests in parallel — contacts, conversations, tags,
    // and conversation-tag map. This cuts the sequential waterfall by ~60%.
    Promise.all([
      loadContacts({ reset: true }),
      loadConversations(),
      loadTags(),
      refreshConversationTags(),
    ]).catch(() => { /* individual errors are already logged inside each fn */ });
    // Only clear selection / message cache on a REAL scope change.
    // The very first effect run (prev === null) is the initial mount —
    // keep any pending selection (e.g. from sessionStorage deep-link).
    if (prev !== null && prev !== key) {
      setSelectedContactId(null);
      setMessages({});
      knownMessageIds.current.clear();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQueueId, clientId, activeQueueIds, periodFilter, sortOrder, queuesLoading]);

  // Reload conversations when ONLY the query group (status tab) changes —
  // without triggering the full bootstrap effect above.
  const prevConvQueryGroupRef = useRef<string | null>(null);
  useEffect(() => {
    if (!clientId || queuesLoading) return;
    // Skip the very first run — the bootstrap effect above already called loadConversations.
    if (prevConvQueryGroupRef.current === null) {
      prevConvQueryGroupRef.current = convQueryGroup;
      return;
    }
    if (prevConvQueryGroupRef.current !== convQueryGroup) {
      prevConvQueryGroupRef.current = convQueryGroup;
      loadConversations();
    }
  }, [clientId, convQueryGroup, loadConversations, queuesLoading]);

  // ============================================
  // Visibility refetch — resilience for suspended tabs
  // ============================================
  // When the tab becomes visible again after >30s in background, silently
  // revalidate the contacts list and the currently-selected conversation's
  // messages. Avoids stale views when the realtime websocket dropped while
  // the user was on another tab.
  const lastHiddenAtRef = useRef<number | null>(null);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
        return;
      }
      // visible
      const hiddenAt = lastHiddenAtRef.current;
      lastHiddenAtRef.current = null;
      if (!hiddenAt) return;
      const awayMs = Date.now() - hiddenAt;
      if (awayMs < 30_000) return;
      // Silent refresh — no setIsLoading(true) so the list does not flash.
      if (clientId) {
        loadContacts({ reset: true }).catch(() => { /* silent */ });
        loadConversations().catch(() => { /* silent */ });
      }
      const cid = selectedContactId;
      if (cid) {
        loadMessages(cid, 50, 0).catch(() => { /* silent */ });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [clientId, selectedContactId, loadContacts, loadConversations, loadMessages]);

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
    downloadMedia,
    markAsRead,
    syncContacts,
    selectContact,
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
    pendingConvCount: convCounts.pending,
    openConvCount: convCounts.open,

    // Tags
    tags,
    loadTags,
    updateTag,
    deleteTag,
    addTagToConversation,
    removeTagFromConversation,
    createTag,
    conversationTagsMap,
    refreshConversationTags,

    // Internal notes
    sendInternalNote,

    // Detail panel
    showDetailPanel,
    setShowDetailPanel,

    // Conversation history
    conversationHistory,
    loadConversationHistory,

    // Contacts pagination
    hasMoreContacts,
    isLoadingMoreContacts,
    loadMoreContacts,

    // Conversations pagination
    hasMoreConversations,
    isLoadingMoreConversations,
    loadMoreConversations,

    // Period filter
    periodFilter,
    setPeriodFilter,

    // Sort order
    sortOrder,
    setSortOrder,

    // Bootstrap readiness — used by children to avoid racing context hydration
    isReady: !!clientId && !queuesLoading && hasLoadedConversationsOnce,

    // Selected contact hydration state
    isHydratingContact,
    contactHydrationError,
    retryHydrateSelectedContact,
  }), [
    contacts, messages, selectedContactId, activeTab, searchQuery, isLoading, isSyncing,
    loadContacts, loadMessages, sendMessage, sendMedia, downloadMedia, markAsRead, syncContacts, selectContact,
    selectedContact, filteredContacts, totalUnreadCount, individualUnreadCount, groupUnreadCount,
    selectedQueue, conversations, selectedConversation, conversationStatusFilter, convCounts,
    loadConversations, getOrCreateConversation, updateConversationStatus, assignConversation,
    tags, loadTags, updateTag, deleteTag, addTagToConversation, removeTagFromConversation, createTag,
    conversationTagsMap, refreshConversationTags,
    sendInternalNote, showDetailPanel, conversationHistory, loadConversationHistory,
    hasMoreContacts, isLoadingMoreContacts, loadMoreContacts,
    hasMoreConversations, isLoadingMoreConversations, loadMoreConversations,
    periodFilter, sortOrder, clientId, queuesLoading, hasLoadedConversationsOnce,
    isHydratingContact, contactHydrationError, retryHydrateSelectedContact,
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
