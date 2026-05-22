import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { externalDb } from '@/lib/externalDb';
import { getServerNowBRT, ensureServerClock } from '@/lib/serverClock';
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
import { useContactLatestConversation, leaderGroup } from '@/hooks/useContactLatestConversation';

// Period filter (mirrors options shown in ChatList)
export type ChatPeriodFilter =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'thisMonth'
  | 'last3Months';

const CONTACTS_PAGE_SIZE = 50;
// Conversation pagination — bigger initial page for instant context, then
// smaller chunks on demand (scroll/click). Avoids the previous "infinite
// auto-loop" that flooded the DB and the browser DOM with thousands of rows.
const CONVERSATIONS_INITIAL_PAGE_SIZE = 1000;
const CONVERSATIONS_NEXT_PAGE_SIZE = 200;
// Auto-bootstrap loads exactly the initial page; everything beyond is on
// demand via `loadMoreConversations`. Kept as a guard against runaway loops.
const CONV_AUTOLOAD_MAX_PAGES = 1;
// Active group cap: 1000 (initial) + 20 × 200 = 5000 conversations max on bootstrap.
// Prevents loading the entire history into memory on first open.
const CONV_AUTOLOAD_ACTIVE_MAX_PAGES = 21;

type ConvLoadGroup = 'active' | 'resolved' | 'closed';
interface ConvGroupMeta {
  pages: number;
  loaded: number;
  hasMore: boolean;
  autoLoadDone: boolean;
  isAutoLoading: boolean;
  cappedAt: number | null;
  error: string | null;
}
const initialConvGroupMeta = (): ConvGroupMeta => ({
  pages: 0,
  loaded: 0,
  hasMore: true,
  autoLoadDone: false,
  isAutoLoading: false,
  cappedAt: null,
  error: null,
});

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

// Compute a stable sort key for a ChatMessage. Primary: timestamp; tie-breaker:
// created_at, then id. Returns a tuple-like number where the timestamp dominates.
function messageSortTs(m: ChatMessage): number {
  const t = m?.timestamp ? new Date(m.timestamp).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function compareMessages(a: ChatMessage, b: ChatMessage): number {
  const ta = messageSortTs(a);
  const tb = messageSortTs(b);
  if (ta !== tb) return ta - tb;
  const ca = a?.created_at ? new Date(a.created_at).getTime() : 0;
  const cb = b?.created_at ? new Date(b.created_at).getTime() : 0;
  if (ca !== cb) return ca - cb;
  const ia = a?.id || '';
  const ib = b?.id || '';
  return ia < ib ? -1 : ia > ib ? 1 : 0;
}

// Insert a single message into an already-ASC-sorted list, preserving order.
// Walks from the end (common case: new message is the most recent) — O(1)
// amortized in the happy path, O(n) worst case for out-of-order arrivals
// (e.g. history backfill, delayed realtime events).
function insertMessageSorted(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  const next = list.slice();
  let i = next.length - 1;
  while (i >= 0 && compareMessages(next[i], msg) > 0) i--;
  next.splice(i + 1, 0, msg);
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
      extraMetadata?: Record<string, any>;
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
  upsertConversation: (conv: ChatConversation) => void;
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

  // Sincroniza relógio do servidor (BRT) para timestamps de envio
  useEffect(() => { ensureServerClock(); }, []);

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
  // Mutable mirror of `selectedContactId` so callbacks (e.g. loadContacts)
  // can read the current selection without re-creating themselves on every
  // change — important to avoid bootstrap effects re-running and racing.
  const selectedContactIdRef = useRef<string | null>(null);
  useEffect(() => { selectedContactIdRef.current = selectedContactId; }, [selectedContactId]);

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
  const [conversationStatusFilter, setConversationStatusFilter] = useState<ConversationFilterStatus>('open');
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [tags, setTags] = useState<ChatTag[]>([]);
  const [conversationTagsMap, setConversationTagsMap] = useState<Record<string, ChatTag[]>>({});
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryEntry[]>([]);

  // Contacts pagination
  const [hasMoreContacts, setHasMoreContacts] = useState(true);
  const [isLoadingMoreContacts, setIsLoadingMoreContacts] = useState(false);

  // Conversations pagination
  // Per-group metadata. The single `conversations` array below holds rows
  // from every group we've ever loaded for the current scope, so switching
  // tabs is instant and never re-queries the DB.
  const [convGroupMeta, setConvGroupMeta] = useState<Record<ConvLoadGroup, ConvGroupMeta>>(() => ({
    active: initialConvGroupMeta(),
    resolved: initialConvGroupMeta(),
    closed: initialConvGroupMeta(),
  }));
  // Epoch is bumped whenever the bootstrap scope changes (clientId, queue,
  // period, sortOrder). Auto-load loops compare their captured epoch against
  // the live ref before each setState to bail out cleanly.
  const convLoadEpochRef = useRef(0);

  // Period filter — defaults to last 7 days every time the chat is opened
  const [periodFilter, setPeriodFilter] = useState<ChatPeriodFilter>('all');
  // Sort order for contacts list — persisted in localStorage so the user
  // preference is preserved across sessions.
  const [sortOrder, setSortOrderState] = useState<'newest' | 'oldest'>(() => {
    if (typeof window === 'undefined') return 'newest';
    const stored = window.localStorage.getItem('chat:sortOrder');
    return stored === 'oldest' ? 'oldest' : 'newest';
  });
  const setSortOrder = useCallback((o: 'newest' | 'oldest') => {
    setSortOrderState(o);
    try {
      window.localStorage.setItem('chat:sortOrder', o);
    } catch {
      /* storage unavailable — ignore */
    }
  }, []);

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

  // Per-contact "leader" conversation (most recent across all queues/statuses).
  // Drives the chat-list deduplication: each contact appears in exactly one
  // status tab — the tab matching its leader's effective group.
  const { leaderByContact } = useContactLatestConversation(clientId, activeQueueIds);

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
        // Preserve the currently-selected contact across resets. The deal/CRM
        // chat panels select a contact directly via id; if `loadContacts`
        // happens to filter it out (different period, group or queue page),
        // the panel would lose `selectedContact` and stay on a skeleton
        // forever. Keep it pinned at the top of the list.
        setContacts(prev => {
          const selId = selectedContactIdRef.current;
          if (!selId) return page;
          const keep = prev.find(c => c.id === selId);
          if (!keep) return page;
          if (page.some(c => c.id === selId)) return page;
          return [keep, ...page];
        });
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
    : conversationStatusFilter === 'resolved_closed' ? 'resolved_closed'
    : 'active';

  // Mirror `convQueryGroup` into a ref so the realtime subscription handler
  // can read the latest filter without re-subscribing on every tab switch.
  const convQueryGroupRef = useRef(convQueryGroup);
  useEffect(() => {
    convQueryGroupRef.current = convQueryGroup;
  }, [convQueryGroup]);

  // Fetch a single page of `chat_conversations` for a given group, merging
  // the result into the global `conversations` list (deduped by id, sorted
  // by updated_at desc). Pure: callers own retry / loop / cancellation.
  const loadConversationsPage = useCallback(async (
    group: ConvLoadGroup,
    offset: number,
    pageSize: number = CONVERSATIONS_NEXT_PAGE_SIZE,
  ): Promise<{ fetched: number; skipped?: boolean }> => {
    if (!clientId || queuesLoading) return { fetched: 0, skipped: true };

    let query = supabase
      .from('chat_conversations')
      .select(CONV_COLUMNS)
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (currentQueueId) query = query.eq('queue_id', currentQueueId);
    else if (activeQueueIds.length > 0) query = query.in('queue_id', activeQueueIds);
    else return { fetched: 0, skipped: true };

    if (group === 'active') query = query.in('status', ['pending', 'open']);
    else query = query.eq('status', group);

    const { data, error } = await query;
    if (error) throw error;

    const page = ((data || []) as unknown) as ChatConversation[];
    if (page.length > 0) {
      setConversations(prev => {
        const map = new Map<string, ChatConversation>();
        for (const c of prev) map.set(c.id, c);
        for (const c of page) map.set(c.id, c);
        return Array.from(map.values()).sort((a, b) => {
          const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return tb - ta;
        });
      });
    }
    return { fetched: page.length };
  }, [clientId, currentQueueId, activeQueueIds, queuesLoading]);

  // Background loop: fetch successive pages of a group until the server
  // returns fewer than CONVERSATIONS_PAGE_SIZE rows OR `maxPages` is hit
  // OR the bootstrap epoch changes (scope reset).
  const runConvAutoLoad = useCallback(async (
    group: ConvLoadGroup,
    maxPages: number,
  ): Promise<void> => {
    const myEpoch = convLoadEpochRef.current;
    // Reentrancy guard: bail out fully (not just the state updater) if a
    // loop is already running for this group or it has already finished.
    const currentMeta = convGroupMetaRef.current?.[group];
    if (currentMeta && (currentMeta.isAutoLoading || currentMeta.autoLoadDone)) {
      return;
    }
    setConvGroupMeta(prev => {
      if (prev[group].isAutoLoading || prev[group].autoLoadDone) return prev;
      return { ...prev, [group]: { ...prev[group], isAutoLoading: true, error: null } };
    });

    let pages = 0;
    let lastFetched = 0;
    let loaded = 0;
    let aborted = false;
    try {
      while (pages < maxPages) {
        if (convLoadEpochRef.current !== myEpoch) { aborted = true; break; }
        const offset = loaded;
        // First page is the big initial chunk; never reached again because
        // `maxPages` is 1 today, but the math stays correct if it changes.
        const pageSize = pages === 0 ? CONVERSATIONS_INITIAL_PAGE_SIZE : CONVERSATIONS_NEXT_PAGE_SIZE;
        let res: { fetched: number; skipped?: boolean };
        try {
          res = await loadConversationsPage(group, offset, pageSize);
        } catch (err) {
          console.error('[WhatsAppDataContext] auto-load page failed', { group, offset, err });
          if (convLoadEpochRef.current === myEpoch) {
            setConvGroupMeta(prev => ({
              ...prev,
              [group]: {
                ...prev[group],
                isAutoLoading: false,
                error: (err as Error)?.message ?? 'unknown error',
              },
            }));
          }
          return;
        }
        if (res.skipped) { aborted = true; break; }
        pages += 1;
        lastFetched = res.fetched;
        loaded += res.fetched;
        const hasMore = res.fetched === pageSize;
        if (convLoadEpochRef.current !== myEpoch) { aborted = true; break; }
        setConvGroupMeta(prev => ({
          ...prev,
          [group]: { ...prev[group], pages, loaded, hasMore },
        }));
        if (group === 'active' && !hasLoadedConversationsOnceRef.current) {
          hasLoadedConversationsOnceRef.current = true;
          setHasLoadedConversationsOnce(true);
        }
        if (!hasMore) break;
      }
    } finally {
      if (!aborted && convLoadEpochRef.current === myEpoch) {
        if (group === 'active' && !hasLoadedConversationsOnceRef.current) {
          hasLoadedConversationsOnceRef.current = true;
          setHasLoadedConversationsOnce(true);
        }
        setConvGroupMeta(prev => {
          const initialPageFull = pages === 1 && lastFetched === CONVERSATIONS_INITIAL_PAGE_SIZE;
          const reachedCap = pages >= maxPages && (initialPageFull || lastFetched === CONVERSATIONS_NEXT_PAGE_SIZE);
          return {
            ...prev,
            [group]: {
              ...prev[group],
              isAutoLoading: false,
              autoLoadDone: true,
              cappedAt: reachedCap ? maxPages : null,
              hasMore: reachedCap, // user can still click "load more"
            },
          };
        });
      } else if (aborted && convLoadEpochRef.current === myEpoch) {
        setConvGroupMeta(prev => ({
          ...prev,
          [group]: { ...prev[group], isAutoLoading: false },
        }));
      }
    }
  }, [loadConversationsPage]);

  // Backwards-compat wrapper kept for the few internal callers that still
  // reference `loadConversations()`. Triggers an auto-load for the currently
  // visible tab (cap depends on group).
  const loadConversations = useCallback(async (): Promise<void> => {
    const group: ConvLoadGroup = convQueryGroupRef.current === 'resolved' ? 'resolved'
      : convQueryGroupRef.current === 'closed' ? 'closed'
      : 'active';
    await runConvAutoLoad(group, CONV_AUTOLOAD_MAX_PAGES);
  }, [runConvAutoLoad]);

  // `loadMoreConversations` advances ONE more page for the current tab —
  // used by the IntersectionObserver fallback in the chat list.
  const loadMoreConversations = useCallback(async (): Promise<void> => {
    const group: ConvLoadGroup = convQueryGroupRef.current === 'resolved' ? 'resolved'
      : convQueryGroupRef.current === 'closed' ? 'closed'
      : 'active';
    const meta = convGroupMetaRef.current[group];
    if (!meta || meta.isAutoLoading || !meta.hasMore) return;
    setConvGroupMeta(prev => ({ ...prev, [group]: { ...prev[group], isAutoLoading: true } }));
    try {
      const res = await loadConversationsPage(
        group,
        meta.loaded,
        CONVERSATIONS_NEXT_PAGE_SIZE,
      );
      if (res.skipped) return;
      setConvGroupMeta(prev => ({
        ...prev,
        [group]: {
          ...prev[group],
          pages: prev[group].pages + 1,
          loaded: prev[group].loaded + res.fetched,
          hasMore: res.fetched === CONVERSATIONS_NEXT_PAGE_SIZE,
        },
      }));
    } catch (err) {
      console.error('[WhatsAppDataContext] loadMoreConversations failed', err);
    } finally {
      setConvGroupMeta(prev => ({ ...prev, [group]: { ...prev[group], isAutoLoading: false } }));
    }
  }, [loadConversationsPage]);

  // Mirror metas + hasLoadedOnce into refs so callbacks above don't have to
  // depend on the state itself (avoids invalidating loadMoreConversations
  // on every meta update, which would re-trigger sentinel observers).
  const convGroupMetaRef = useRef(convGroupMeta);
  useEffect(() => { convGroupMetaRef.current = convGroupMeta; }, [convGroupMeta]);
  const hasLoadedConversationsOnceRef = useRef(false);

  // Derived flags exposed via context — refer to the currently active tab.
  const currentConvGroup: ConvLoadGroup = convQueryGroup === 'resolved' ? 'resolved'
    : convQueryGroup === 'closed' ? 'closed'
    : convQueryGroup === 'resolved_closed' ? 'resolved' // for "ambos", expose resolved meta as the leading indicator
    : 'active';
  const hasMoreConversations = convGroupMeta[currentConvGroup].hasMore;
  const isLoadingMoreConversations = convGroupMeta[currentConvGroup].isAutoLoading;

  // Derived counts straight from in-memory `conversations` — no extra DB
  // round-trip. The realtime channel keeps `conversations` fresh, so these
  // counts react instantly to inserts/updates without re-querying.
  // NOTE: ChatList recomputes its own filtered counts; these are the
  // unfiltered totals exposed via context for backwards compatibility.
  const convCounts = useMemo(() => {
    let pending = 0, open = 0;
    // Count DISTINCT contacts whose leader conversation sits in the active group.
    // Mirrors the deduplication applied to `filteredContacts` below.
    for (const leader of leaderByContact.values()) {
      if (leaderGroup(leader) !== 'active') continue;
      const hasAssignee = !!(leader.assigned_to && String(leader.assigned_to).trim() !== '');
      const effective = leader.status === 'pending' && hasAssignee ? 'open' : leader.status;
      if (effective === 'pending') pending++;
      else if (effective === 'open') open++;
    }
    return { pending, open };
  }, [leaderByContact]);

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
      .order('created_at', { ascending: true })
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
      extraMetadata?: Record<string, any>;
    }
  ) => {
    const noteType = options?.noteType || 'info';
    const extraMetadata = options?.extraMetadata || {};
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
      timestamp: getServerNowBRT(),
      created_at: getServerNowBRT(),
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
      metadata: { ...extraMetadata, internal_note: true, sender_name: senderName, note_type: noteType },
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
            const merged = [...ordered, ...realtimeOnly].sort(compareMessages);
            return { ...prev, [contactId]: merged };
          }
          // Append older page above existing list, with dedupe.
          const existingIds = new Set(existing.map(m => m.id));
          const newOlder = ordered.filter(m => !existingIds.has(m.id));
          const merged = [...newOlder, ...existing].sort(compareMessages);
          return { ...prev, [contactId]: merged };
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
    replyToMessage?: ChatMessage,
    options?: { forward?: boolean }
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
      timestamp: getServerNowBRT(),
      created_at: getServerNowBRT(),
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
              replyid: replyToMessage?.message_id || replyToMessage?.external_id || undefined,
              forward: options?.forward === true ? true : undefined,
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
        // Prefer the WhatsApp stanza id (key.id) for message_id — that's the id
        // the provider uses in status/edit events. Keep the uazapi internal id
        // as external_id fallback so the webhook can still match either way.
        const waStanzaId = proxyData?.key?.id;
        const uazInternalId = proxyData?.id || proxyData?.messageId || proxyData?.messageid;
        externalMessageId = waStanzaId || uazInternalId;
        // Stash both ids on the closure scope for the insert below.
        (tempMessage as any).__wa_id = waStanzaId || externalMessageId;
        (tempMessage as any).__uaz_id = uazInternalId || externalMessageId;
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
        message_id: (tempMessage as any).__wa_id ?? externalMessageId,
        external_id: (tempMessage as any).__uaz_id ?? externalMessageId,
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
  // Edit an already-sent text message (UaZapi only)
  // ============================================
  const editMessage = useCallback(async (
    contactId: string,
    message: ChatMessage,
    newText: string,
  ) => {
    const trimmed = newText.trim();
    if (!trimmed || trimmed === message.text) return;

    const queue = await getEffectiveQueue(contactId);
    if (!queue) {
      toast.error('Sem fila ativa para este contato');
      return;
    }
    if (queue.channel_type === 'waba') {
      toast.error('A API oficial do WhatsApp não permite editar mensagens.');
      return;
    }

    const targetId = message.external_id || message.message_id;
    if (!targetId) {
      toast.error('Mensagem sem identificador para edição');
      return;
    }

    const editedAt = new Date().toISOString();
    const previousText = message.text;

    // Optimistic update
    setMessages(prev => ({
      ...prev,
      [contactId]: prev[contactId]?.map(m =>
        m.id === message.id ? { ...m, text: trimmed, edited_at: editedAt } : m
      ) || [],
    }));

    try {
      const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          method: 'POST',
          endpoint: '/message/edit',
          token: queue.evo_apikey,
          baseUrl: queue.evo_url,
          body: { id: targetId, text: trimmed },
        },
      });
      if (error) throw error;
      if (!data?.ok) {
        const upstream = data?.data;
        const msg = upstream?.message || upstream?.error || `UaZapi status ${data?.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      const editResponse = data?.data || {};
      const editedEnvelopeId = editResponse?.id || editResponse?.messageId || editResponse?.messageid || editResponse?.key?.id;

      setMessages(prev => ({
        ...prev,
        [contactId]: prev[contactId]?.map(m =>
          m.id === message.id
            ? { ...m, text: trimmed, edited_at: editedAt, external_id: editedEnvelopeId || m.external_id }
            : m
        ) || [],
      }));

      // UaZapi returns a fresh envelope id for edited messages. Persist it in
      // external_id so the subsequent webhook upsert matches the existing row
      // and is skipped instead of being inserted as a duplicate message.
      await supabase
        .from('chat_messages')
        .update({
          text: trimmed,
          edited_at: editedAt,
          ...(editedEnvelopeId ? { external_id: editedEnvelopeId } : {}),
        })
        .eq('id', message.id);
    } catch (err) {
      console.error('Error editing message:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao editar mensagem');
      // Revert optimistic update
      setMessages(prev => ({
        ...prev,
        [contactId]: prev[contactId]?.map(m =>
          m.id === message.id ? { ...m, text: previousText, edited_at: message.edited_at } : m
        ) || [],
      }));
    }
  }, [getEffectiveQueue]);

  // ============================================
  // Send Media via Edge Function
  // ============================================
  const sendMedia = useCallback(async (
    contactId: string,
    file: File,
    type: MessageType,
    caption?: string,
    options?: { forward?: boolean }
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
      timestamp: getServerNowBRT(),
      created_at: getServerNowBRT(),
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
              forward: options?.forward === true ? true : undefined,
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
        const waStanzaId = mediaProxyData?.key?.id;
        const uazInternalId = mediaProxyData?.id || mediaProxyData?.messageId || mediaProxyData?.messageid;
        externalMessageId = waStanzaId || uazInternalId;
        (tempMessage as any).__wa_id = waStanzaId || externalMessageId;
        (tempMessage as any).__uaz_id = uazInternalId || externalMessageId;
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
        message_id: (tempMessage as any).__wa_id ?? externalMessageId,
        external_id: (tempMessage as any).__uaz_id ?? externalMessageId,
        media_url: persistedUrl,
        file_name: file.name,
        caption,
        timestamp: tempMessage.timestamp,
        created_at: tempMessage.created_at,
        conversation_id: conversation?.id,
        sender_name: user?.name,
      });

      // Auto-transcribe outgoing audio when AUTO_TRANSCRIBE_AUDIO is enabled
      // for the client. The webhook only handles incoming/echoed audios, so
      // optimistic outgoing audios need an explicit trigger here.
      if (isAudioMessage) {
        (async () => {
          try {
            const { data: cs } = await supabase
              .from('chat_client_settings')
              .select('settings')
              .eq('client_id', clientId)
              .maybeSingle();
            const enabled = Boolean((cs?.settings as any)?.auto_transcribe_audio);
            if (!enabled) return;
            await supabase.functions.invoke('chat-transcribe-audio', {
              body: { message_id: tempMessage.id },
            });
          } catch (e) {
            console.warn('[sendMedia] auto-transcribe error:', e);
          }
        })();
      }

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

  /**
   * Insere ou atualiza uma conversa no array `conversations` sem depender
   * do bootstrap/paginação. Usado por consumidores externos (ex: painel
   * lateral do CRM) que precisam garantir que `selectedConversation`
   * derive corretamente para um contato específico.
   */
  const upsertConversation = useCallback((conv: ChatConversation) => {
    if (!conv?.id) return;
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === conv.id);
      if (idx === -1) return [conv, ...prev];
      const next = prev.slice();
      next[idx] = { ...prev[idx], ...conv };
      return next;
    });
  }, []);

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
     // Leader = most recent conversation for this contact across all queues/statuses.
     // Prefer the loaded copy from `conversations` (carries any local mutations);
     // fall back to the leader map (which may include conversations whose group
     // hasn't been auto-loaded yet, e.g. closed tickets while on the active tab).
     const leader = leaderByContact.get(selectedContactId);
     if (leader) {
       const loaded = conversations.find(c => c.id === leader.id);
       return loaded || leader;
     }
     // Defensive fallback to legacy behavior if the leader map is still cold.
     return conversations.find(c => c.contact_id === selectedContactId && ['pending', 'open'].includes(c.status))
       || conversations.find(c => c.contact_id === selectedContactId && ['resolved', 'closed'].includes(c.status))
       || null;
   }, [conversations, selectedContactId, leaderByContact]);

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

    // Dedup by contact: each contact appears in exactly one status tab, decided
    // by its leader conversation (most recent across all queues/channels).
    if (conversationStatusFilter !== 'all') {
      filtered = filtered.filter(c => {
        const leader = leaderByContact.get(c.id);
        if (!leader) return false;
        const group = leaderGroup(leader);
        if (!group) return false;
        if (conversationStatusFilter === 'resolved_closed') {
          return group === 'resolved' || group === 'closed';
        }
        // 'pending' and 'open' tabs both map to the 'active' group; respect the
        // existing effective-status convention (pending + assignee → open).
        if (conversationStatusFilter === 'pending' || conversationStatusFilter === 'open') {
          if (group !== 'active') return false;
          const hasAssignee = !!(leader.assigned_to && String(leader.assigned_to).trim() !== '');
          const effective = leader.status === 'pending' && hasAssignee ? 'open' : leader.status;
          return effective === conversationStatusFilter;
        }
        return group === conversationStatusFilter;
      });
    } else {
      // Hide contacts whose leader is currently snoozed.
      const now = Date.now();
      filtered = filtered.filter(c => {
        const leader = leaderByContact.get(c.id);
        const snoozedUntil = (leader as { snoozed_until?: string | null } | undefined)?.snoozed_until;
        if (snoozedUntil && new Date(snoozedUntil).getTime() > now) return false;
        return true;
      });
    }

    // Always sort by most recent message (WhatsApp-style)
    filtered = [...filtered].sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });

    return filtered;
  }, [contacts, activeTab, searchQuery, conversationStatusFilter, leaderByContact]);

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
              [enriched.contact_id]: insertMessageSorted(existing, enriched),
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
            setContacts(prev => {
              const updated = prev.map(c =>
                c.id === newMessage.contact_id
                  ? { ...c, last_message_text: previewOut || c.last_message_text, last_message_at: newMessage.timestamp || newMessage.created_at || c.last_message_at }
                  : c
              );
              const target = updated.find(c => c.id === newMessage.contact_id);
              return target ? repositionContact(updated, target) : updated;
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
            setContacts(prev => {
              const updated = prev.map(c =>
                c.id === newMessage.contact_id
                  ? { ...c, unread_count: (c.unread_count || 0) + 1, last_message_text: previewIn || c.last_message_text, last_message_at: newMessage.timestamp || newMessage.created_at || c.last_message_at }
                  : c
              );
              const target = updated.find(c => c.id === newMessage.contact_id);
              return target ? repositionContact(updated, target) : updated;
            });

            // Persist to DB using an atomic SQL increment — prevents race condition
            // when multiple agents are online and both try to read-then-write the counter.
            supabase.rpc('increment_contact_unread', {
              p_contact_id: newMessage.contact_id,
              p_preview: previewIn || null,
              p_last_at: newMessage.timestamp || newMessage.created_at || new Date().toISOString(),
            }).then(
              () => undefined,
              (e: unknown) => console.warn('failed to bump unread_count:', e),
            );
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
          // Merge instead of replace so we don't drop in-memory enrichments
          // (decrypted media_url, transcription metadata, etc.) when the DB
          // emits a partial UPDATE (e.g. status tick or edited_at).
          setMessages(prev => ({
            ...prev,
            [updated.contact_id]: (prev[updated.contact_id] || []).map(m =>
              m.id === updated.id
                ? {
                    ...m,
                    ...updated,
                    metadata: { ...(m.metadata || {}), ...((updated as any).metadata || {}) },
                  }
                : m
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
            // We keep ALL groups (active / resolved / closed) in memory at
            // once, so realtime updates only need to upsert — never drop.
            // The chat list filters by status itself for the active tab.
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
    // Skip when nothing meaningful changed (e.g. activeQueueIds got a new
    // reference but same contents). Without this gate, the auto-load loop
    // would be killed and restarted from offset 0 on every queue re-fetch,
    // never reaching completion on large histories.
    if (prev !== null && prev === key) return;
    bootstrapKeyRef.current = key;
    setHasMoreContacts(true);
    // Bump epoch — kills any in-flight auto-load loop from the previous scope.
    convLoadEpochRef.current += 1;
    // Reset per-group metadata + start the eager loop for the active tab.
    setConvGroupMeta({
      active: initialConvGroupMeta(),
      resolved: initialConvGroupMeta(),
      closed: initialConvGroupMeta(),
    });
    hasLoadedConversationsOnceRef.current = false;
    setHasLoadedConversationsOnce(false);
    setConversations([]);
    Promise.all([
      loadContacts({ reset: true }),
      loadTags(),
      refreshConversationTags(),
    ]).catch(() => { /* individual errors are already logged inside each fn */ });
    // Eager: load up to ~5 000 pending+open conversations on bootstrap.
    // CONV_AUTOLOAD_ACTIVE_MAX_PAGES = 21 → 1 000 + 20 × 200 rows cap.
    runConvAutoLoad('active', CONV_AUTOLOAD_ACTIVE_MAX_PAGES)
      .catch(err => console.error('[WhatsAppDataContext] active auto-load failed', err));
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

  // When the user activates the resolved / closed (or both) tab for the
  // first time in this scope, kick off a capped auto-load (10 × 500 = 5_000
  // rows max). Subsequent visits to the same tab are instant — no DB hit.
  useEffect(() => {
    if (!clientId || queuesLoading) return;
    const groupsToLoad: ConvLoadGroup[] = convQueryGroup === 'resolved' ? ['resolved']
      : convQueryGroup === 'closed' ? ['closed']
      : convQueryGroup === 'resolved_closed' ? ['resolved', 'closed']
      : [];
    for (const g of groupsToLoad) {
      const meta = convGroupMetaRef.current[g];
      if (meta && !meta.autoLoadDone && !meta.isAutoLoading) {
        runConvAutoLoad(g, CONV_AUTOLOAD_MAX_PAGES)
          .catch(err => console.error('[WhatsAppDataContext]', g, 'auto-load failed', err));
      }
    }
  }, [clientId, convQueryGroup, queuesLoading, runConvAutoLoad]);

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
        // Conversations are kept in sync via realtime; no full refetch on
        // visibility change. Realtime will deliver any missed events on
        // reconnect, and counts/lists update automatically.
      }
      const cid = selectedContactId;
      if (cid) {
        loadMessages(cid, 50, 0).catch(() => { /* silent */ });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [clientId, selectedContactId, loadContacts, loadMessages]);

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
    editMessage,
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
    upsertConversation,
  }), [
    contacts, messages, selectedContactId, activeTab, searchQuery, isLoading, isSyncing,
    loadContacts, loadMessages, sendMessage, editMessage, sendMedia, downloadMedia, markAsRead, syncContacts, selectContact,
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
    upsertConversation,
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
