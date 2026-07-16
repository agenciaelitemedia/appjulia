/**
 * Helpers para o deep-link entre o painel lateral do CRM e a página /chat.
 * Centraliza leitura/escrita/limpeza dos itens `chat_pending_*` no
 * sessionStorage, com validação de UUID e TTL para evitar restos órfãos
 * quando o usuário navega rapidamente entre cards.
 */

const KEY_CONTACT = 'chat_pending_contact_id';
const KEY_QUEUE = 'chat_pending_queue_id';
const KEY_CONVERSATION = 'chat_pending_conversation_id';
const KEY_TAB = 'chat_pending_tab';
const KEY_SEARCH = 'chat_pending_search';
const KEY_TS = 'chat_pending_ts';

const PENDING_KEYS = [KEY_CONTACT, KEY_QUEUE, KEY_CONVERSATION, KEY_TAB, KEY_SEARCH, KEY_TS] as const;

const TTL_MS = 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && UUID_RE.test(v);

const safeStorage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

export interface PendingSelection {
  contactId: string;
  queueId: string | null;
  conversationId: string | null;
  tab: PendingTab | null;
  search: string | null;
}

export type PendingTab = 'pending' | 'open' | 'resolved_closed';
const VALID_TABS: PendingTab[] = ['pending', 'open', 'resolved_closed'];

export function clearPendingSelection(): void {
  const ss = safeStorage();
  if (!ss) return;
  for (const k of PENDING_KEYS) {
    try { ss.removeItem(k); } catch { /* noop */ }
  }
}

export function setPendingSelection(input: {
  contactId: string;
  queueId?: string | null;
  conversationId?: string | null;
  tab?: PendingTab | null;
  search?: string | null;
}): void {
  const ss = safeStorage();
  if (!ss) return;
  // Sempre limpa antes para evitar mistura entre cards
  clearPendingSelection();
  if (!isUuid(input.contactId)) return;
  try {
    ss.setItem(KEY_CONTACT, input.contactId);
    if (isUuid(input.queueId)) ss.setItem(KEY_QUEUE, input.queueId as string);
    if (isUuid(input.conversationId)) ss.setItem(KEY_CONVERSATION, input.conversationId as string);
    if (input.tab && VALID_TABS.includes(input.tab)) ss.setItem(KEY_TAB, input.tab);
    if (typeof input.search === 'string' && input.search.trim() !== '') {
      ss.setItem(KEY_SEARCH, input.search.trim().slice(0, 64));
    }
    ss.setItem(KEY_TS, String(Date.now()));
  } catch {
    /* noop */
  }
}

export function readPendingSelection(): PendingSelection | null {
  const ss = safeStorage();
  if (!ss) return null;
  const contactId = ss.getItem(KEY_CONTACT);
  if (!isUuid(contactId)) {
    // entrada inválida ou ausente — limpa qualquer resto
    if (contactId !== null) clearPendingSelection();
    return null;
  }
  const tsRaw = ss.getItem(KEY_TS);
  const ts = tsRaw ? Number(tsRaw) : NaN;
  if (!Number.isFinite(ts) || Date.now() - ts > TTL_MS) {
    clearPendingSelection();
    return null;
  }
  const queueId = ss.getItem(KEY_QUEUE);
  const conversationId = ss.getItem(KEY_CONVERSATION);
  const tabRaw = ss.getItem(KEY_TAB);
  const tab = tabRaw && (VALID_TABS as string[]).includes(tabRaw) ? (tabRaw as PendingTab) : null;
  const search = ss.getItem(KEY_SEARCH);
  return {
    contactId,
    queueId: isUuid(queueId) ? queueId : null,
    conversationId: isUuid(conversationId) ? conversationId : null,
    tab,
    search: search && search.length > 0 ? search : null,
  };
}

export function clearPendingSelectionFor(contactId: string): void {
  const ss = safeStorage();
  if (!ss) return;
  if (ss.getItem(KEY_CONTACT) === contactId) clearPendingSelection();
}
