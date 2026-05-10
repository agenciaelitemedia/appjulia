import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, MessageCircle, Users, Layers, Bot, User, UserCheck, UserX, ListFilter, CheckCheck, UserCircle, ChevronsUpDown, CalendarDays, Settings, BarChart3, ArrowDownUp, ArrowDown, ArrowUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { TeamMemberSelect } from '@/components/TeamMemberSelect';
import { TagsManagerDialog } from './TagsManagerDialog';
import { NewConversationDialog } from './NewConversationDialog';
import { MessageSquarePlus } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ChatContactItem } from './ChatContactItem';
import { Badge } from '@/components/ui/badge';
import { useAccessibleQueues } from '@/pages/agente/filas/hooks/useQueues';
import { useAgentQueueLimits } from '@/pages/agente/filas/hooks/useAgentQueueLimits';
import { useChatSlaConfigs, evaluateSla, type SlaStatus } from '@/hooks/useChatSlaConfigs';
import { useConversationsLastMessageMeta } from '@/hooks/useConversationsLastMessageMeta';
import { useQueueAgentLinks } from '@/hooks/useQueueAgentLink';
import { useAgentSessionStatusesBatch } from '@/hooks/useAgentSessionStatusesBatch';
import { useCRMStages } from '@/pages/crm/hooks/useCRMData';
import { useMyAgents } from '@/pages/agente/meus-agentes/hooks/useMyAgents';
import { useAgentAliases, getDefaultAlias } from '@/hooks/useAgentAliases';
import { useCRMStageByPhone } from '@/hooks/useCRMStageByPhone';
import { useCRMBuilderLinkedConversations } from '@/hooks/useCRMBuilderLinkedConversations';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { externalDb } from '@/lib/externalDb';
import { useChatContactsByIds } from '@/hooks/useChatContactsByIds';
import { startOfDay, subDays, startOfMonth, subMonths } from 'date-fns';
import type { ConversationFilterStatus } from '@/types/conversation';
import { cn } from '@/lib/utils';

type ConversationModeFilter = 'all' | 'julia' | 'human';
type AssigneeFilter = 'all' | 'mine' | 'unassigned';
type PeriodFilter = 'all' | 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'last3Months';

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7days', label: '7 dias' },
  { value: 'thisMonth', label: 'Mês atual' },
  { value: 'last3Months', label: '3 meses' },
];

function getDateRange(p: PeriodFilter): { from: Date; to: Date } | null {
  if (p === 'all') return null;
  const now = new Date();
  const todayStart = startOfDay(now);
  switch (p) {
    case 'today': return { from: todayStart, to: now };
    case 'yesterday': {
      const yStart = subDays(todayStart, 1);
      return { from: yStart, to: todayStart };
    }
    case 'last7days': return { from: subDays(todayStart, 7), to: now };
    case 'thisMonth': return { from: startOfMonth(now), to: now };
    case 'last3Months': return { from: subMonths(todayStart, 3), to: now };
  }
}

export function ChatList() {
  const {
    filteredContacts,
    selectedContactId,
    activeTab,
    searchQuery,
    isLoading,
    isSyncing,
    selectContact,
    setActiveTab,
    setSearchQuery,
    syncContacts,
    totalUnreadCount,
    individualUnreadCount,
    groupUnreadCount,
    selectedQueue,
    setSelectedQueue,
    conversationStatusFilter,
    setConversationStatusFilter,
    conversations,
    conversationTagsMap,
    contacts,
    hasMoreContacts,
    isLoadingMoreContacts,
    loadMoreContacts,
    periodFilter,
    setPeriodFilter,
    sortOrder,
    setSortOrder,
  } = useWhatsAppData();
  const { data: queueLimits } = useAgentQueueLimits();
  const showGroupsTab = !!(queueLimits?.allowGroups && queueLimits?.showGroupsTab);
  const { hasMoreConversations, loadMoreConversations } = useWhatsAppData();

  useEffect(() => {
    if (!showGroupsTab && activeTab === 'groups') {
      setActiveTab('individual');
    }
  }, [showGroupsTab, activeTab, setActiveTab]);

  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { data: queues = [] } = useAccessibleQueues();
  const { configs: slaConfigs } = useChatSlaConfigs();
  const [modeFilter, setModeFilter] = useState<ConversationModeFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [stageIds, setStageIds] = useState<number[]>([]);
  const [stagePopoverOpen, setStagePopoverOpen] = useState(false);
  const [showTagsManager, setShowTagsManager] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [footerCountry, setFooterCountry] = useState('55');
  const [footerPhone, setFooterPhone] = useState('');

  // Infinite scroll refs — sentinel at the bottom of the list triggers
  // loadMoreContacts when it enters the viewport.
  const listRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  // Sentinel for auto-loading more conversations (badges stay in sync)
  const convSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreContacts && !isLoadingMoreContacts) {
          loadMoreContacts();
        }
      },
      { root, threshold: 0.1, rootMargin: '120px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreContacts, isLoadingMoreContacts, loadMoreContacts]);

  // Auto-load more conversations when the list sentinel is visible
  useEffect(() => {
    const sentinel = convSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreConversations) {
          loadMoreConversations();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreConversations, loadMoreConversations]);
  const activeQueues = queues.filter(q => q.is_active && !q.is_deleted);

  // Default = "Todas as filas" (selectedQueue null). No auto-select.

  // SLA status per contact (worst across that contact's open conversations)
  const openConvIds = React.useMemo(
    () => conversations.filter(c => ['pending', 'open'].includes(c.status)).map(c => c.id),
    [conversations],
  );
  const { metaMap: lastMsgMetaMap, getMeta: getLastMsgMeta } = useConversationsLastMessageMeta(openConvIds);

  const slaStatusByContact = React.useMemo(() => {
    const map = new Map<string, SlaStatus>();
    const rank: Record<SlaStatus, number> = { breached: 3, at_risk: 2, on_track: 1, unknown: 0 };
    conversations.forEach((conv) => {
      if (!['pending', 'open'].includes(conv.status)) return;
      const meta = lastMsgMetaMap.get(conv.id);
      const evalRes = evaluateSla(
        {
          status: conv.status,
          priority: conv.priority,
          opened_at: conv.opened_at,
          first_response_at: conv.first_response_at || null,
          resolved_at: conv.resolved_at || null,
          closed_at: conv.closed_at || null,
          last_customer_message_at: meta?.last_customer_message_at ?? null,
          last_message_from_me: meta?.last_message_from_me ?? null,
        },
        slaConfigs
      );
      const prev = map.get(conv.contact_id);
      if (!prev || rank[evalRes.status] > rank[prev]) {
        map.set(conv.contact_id, evalRes.status);
      }
    });
    return map;
  }, [conversations, slaConfigs, lastMsgMetaMap]);

  const breachedCount = React.useMemo(
    () => Array.from(slaStatusByContact.values()).filter((s) => s === 'breached').length,
    [slaStatusByContact]
  );
  const atRiskCount = React.useMemo(
    () => Array.from(slaStatusByContact.values()).filter((s) => s === 'at_risk').length,
    [slaStatusByContact]
  );

  // Sort conversations once (newest first) — reused by multiple memos to avoid
  // re-sorting on every dependency change. Uses Date.parse once per item to
  // skip Date allocations in the comparator.
  const sortedConversations = React.useMemo(() => {
    const withTs = conversations.map((c) => ({
      c,
      ts: Date.parse(c.updated_at || c.created_at || '') || 0,
    }));
    withTs.sort((a, b) => b.ts - a.ts);
    return withTs.map((x) => x.c);
  }, [conversations]);

  // Map contact_id -> { codAgent, queueId } from most recent conversation
  const convMetaByContact = React.useMemo(() => {
    const map = new Map<string, { codAgent?: string; queueId?: string; assignedTo?: string | null }>();
    sortedConversations.forEach((conv) => {
      if (!map.has(conv.contact_id)) {
        map.set(conv.contact_id, {
          codAgent: conv.cod_agent || undefined,
          queueId: conv.queue_id || undefined,
          assignedTo: conv.assigned_to || null,
        });
      }
    });
    return map;
  }, [sortedConversations]);

  // Pre-group all conversations by contact (already sorted DESC by date) so
  // the row renderer can pick the most recent + first-with-queue in O(1)
  // instead of doing `conversations.filter(...).sort(...)` per row.
  const convsByContact = React.useMemo(() => {
    const map = new Map<string, typeof sortedConversations>();
    for (const conv of sortedConversations) {
      const arr = map.get(conv.contact_id);
      if (arr) arr.push(conv);
      else map.set(conv.contact_id, [conv]);
    }
    return map;
  }, [sortedConversations]);

  // Batch-load queue → agent links for all visible queues
  const queueIds = React.useMemo(() => {
    const set = new Set<string>();
    convMetaByContact.forEach((m) => { if (m.queueId) set.add(m.queueId); });
    return Array.from(set);
  }, [convMetaByContact]);
  const { data: queueAgentMap } = useQueueAgentLinks(queueIds);

  // For every contact whose conversation runs through a Julia-enabled queue,
  // build (whatsapp, codAgent) pairs and batch-load their session.active flag.
  // A "Julia" conversation is only counted as Julia when active=true; if the
  // session is paused (active=false), it is treated as "Atendimento Humano".
  const sessionPairs = React.useMemo(() => {
    const pairs: { whatsappNumber: string; codAgent: string; key: string }[] = [];
    const seen = new Set<string>();
    contacts.forEach((c) => {
      const meta = convMetaByContact.get(c.id);
      if (!meta?.queueId || !c.phone) return;
      const link = queueAgentMap?.get(meta.queueId);
      if (!link?.hasAgent || !link.codAgent) return;
      const phone = c.phone.replace(/\D/g, '');
      if (!phone) return;
      const key = `${phone}:${link.codAgent}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ whatsappNumber: phone, codAgent: link.codAgent, key });
    });
    return pairs;
  }, [contacts, convMetaByContact, queueAgentMap]);

  const { data: sessionActiveMap } = useAgentSessionStatusesBatch(
    sessionPairs.map(({ whatsappNumber, codAgent }) => ({ whatsappNumber, codAgent }))
  );

  const contactPhoneById = React.useMemo(() => {
    const map = new Map<string, string | null>();
    contacts.forEach((c) => map.set(c.id, c.phone || null));
    return map;
  }, [contacts]);

  // Resolve session.active for a (contactId, queueLink) pair. Returns:
  //  - true: Julia ativa
  //  - false: Julia inativa (humano assumiu)
  //  - undefined: unknown / no session loaded yet
  const getSessionActive = React.useCallback(
    (phone: string | null | undefined, codAgent: string | null | undefined): boolean | undefined => {
      if (!phone || !codAgent) return undefined;
      const key = `${phone.replace(/\D/g, '')}:${codAgent}`;
      return sessionActiveMap?.get(key);
    },
    [sessionActiveMap]
  );

  // Derive primary cod_agent for team-members fetch
  const { data: userAgents = [] } = useQuery({
    queryKey: ['chat-user-agents', user?.id],
    queryFn: () => externalDb.getUserAgents<{ cod_agent: string }>(user!.id as number),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: agentsData } = useMyAgents();
  const allAgents = [
    ...(agentsData?.myAgents || []),
    ...(agentsData?.monitoredAgents || []),
  ];
  const { data: teamMembers = [] } = useTeamByClient();
  const { data: stages = [] } = useCRMStages();
  const { aliasMap } = useAgentAliases();

  // cod_agent → business name (fallback when no alias configured)
  const agentBusinessNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    allAgents.forEach(a => {
      if (a.cod_agent) {
        const name = a.client_name || getDefaultAlias(a.business_name) || '';
        if (name) map.set(String(a.cod_agent), name);
      }
    });
    return map;
  }, [allAgents, getDefaultAlias]);

  // Phone → stage map
  const allPhones = React.useMemo(
    () => filteredContacts.map((c) => c.phone).filter(Boolean) as string[],
    [filteredContacts]
  );
  const { data: stageByPhone } = useCRMStageByPhone(allPhones);
  const { data: crmBuilderMap } = useCRMBuilderLinkedConversations();

  const stageSet = React.useMemo(() => new Set(stageIds), [stageIds]);
  const allStagesSelected = stages.length > 0 && stageIds.length === stages.length;
  const stageLabel = React.useMemo(() => {
    if (stageIds.length === 0 || allStagesSelected) return 'Todas as etapas';
    if (stageIds.length === 1) {
      const s = stages.find((x) => x.id === stageIds[0]);
      return s?.name ?? '1 etapa';
    }
    return `${stageIds.length} etapas`;
  }, [stageIds, stages, allStagesSelected]);

  const toggleStage = (id: number) => {
    if (stageSet.has(id)) setStageIds(stageIds.filter((x) => x !== id));
    else setStageIds([...stageIds, id]);
  };
  const toggleAllStages = () => {
    setStageIds(allStagesSelected ? [] : stages.map((s) => s.id));
  };

  const getContactMode = React.useCallback(
    (contactId: string): Exclude<ConversationModeFilter, 'all'> => {
      const meta = convMetaByContact.get(contactId);
      const queueLink = meta?.queueId ? queueAgentMap?.get(meta.queueId) : undefined;
      if (!queueLink?.hasAgent) return 'human';
      // Só classifica como 'julia' quando há sessão ATIVA confirmada.
      // Sessão pausada (active === false) ou inexistente => humano.
      const phone = contactPhoneById.get(contactId);
      const active = getSessionActive(phone, queueLink.codAgent);
      return active === true ? 'julia' : 'human';
    },
    [convMetaByContact, queueAgentMap, contactPhoneById, getSessionActive]
  );

  const getConversationMode = React.useCallback(
    (conv: typeof conversations[number]): Exclude<ConversationModeFilter, 'all'> => {
      const queueLink = conv.queue_id ? queueAgentMap?.get(conv.queue_id) : undefined;
      if (!queueLink?.hasAgent) return 'human';
      const phone = contactPhoneById.get(conv.contact_id);
      const active = getSessionActive(phone, queueLink.codAgent);
      return active === true ? 'julia' : 'human';
    },
    [conversations, queueAgentMap, contactPhoneById, getSessionActive]
  );

  // Reusable client-side filters (owner, period, stage, sla, mode).
  // Does NOT include: tab Individual/Grupos, search, or conversationStatusFilter.
  // Tab + search are applied separately so we can build count bases that
  // ignore the active status tab (pending/open) but still respect them.
  const applyClientFilters = React.useCallback(
    (list: typeof filteredContacts) => {
      let result = list;
      if (ownerFilter !== 'all') {
        const selectedMember = teamMembers.find((m) => String(m.id) === ownerFilter);
        result = result.filter((c) => {
          const assigned = convMetaByContact.get(c.id)?.assignedTo;
          if (ownerFilter === 'unassigned') return !assigned;
          if (ownerFilter === 'mine') {
            if (!assigned) return false;
            return assigned === String(user?.id) || assigned === user?.name;
          }
          if (!assigned) return false;
          return assigned === ownerFilter || (selectedMember && assigned === selectedMember.name);
        });
      }
      if (periodFilter !== 'all') {
        const range = getDateRange(periodFilter);
        if (range) {
          result = result.filter((c) => {
            const ts = c.last_message_at || (c as any).updated_at;
            if (!ts) return false;
            const d = new Date(ts);
            if (Number.isNaN(d.getTime())) return false;
            return d >= range.from && d <= range.to;
          });
        }
      }
      if (stageIds.length > 0 && stageByPhone) {
        result = result.filter((c) => {
          const norm = (c.phone || '').replace(/\D/g, '');
          const info = stageByPhone.get(norm);
          return info ? stageIds.includes(info.stageId) : false;
        });
      }
      if (modeFilter !== 'all') {
        result = result.filter((c) => getContactMode(c.id) === modeFilter);
      }
      return result;
    },
    [ownerFilter, teamMembers, convMetaByContact, user?.id, user?.name, periodFilter, stageIds, stageByPhone, modeFilter, getContactMode]
  );

  // Count conversations by status — scoped to the active tab (Individual / Groups)
  // so badges match what the user actually sees in the list.
  const isGroupByContactId = React.useMemo(() => {
    const map = new Map<string, boolean>();
    contacts.forEach((c) => map.set(c.id, !!c.is_group));
    return map;
  }, [contacts]);

  const matchesActiveTab = React.useCallback(
    (contactId: string) => {
      if (!showGroupsTab) return !isGroupByContactId.get(contactId);
      const isGroup = !!isGroupByContactId.get(contactId);
      if (activeTab === 'individual') return !isGroup;
      if (activeTab === 'groups') return isGroup;
      return true;
    },
    [isGroupByContactId, activeTab, showGroupsTab]
  );

  // Map contact_id -> conversation status (most-recent conversation per contact).
  const statusByContact = React.useMemo(() => {
    const map = new Map<string, string>();
    sortedConversations.forEach((c) => {
      if (!map.has(c.contact_id)) map.set(c.contact_id, c.status);
    });
    return map;
  }, [sortedConversations]);

  // "Em Atendimento" restriction for non-privileged roles:
  // users that are NOT admin/colaborador/user only see open conversations
  // assigned to themselves. Pending (Em Aberto) remains visible to everyone
  // with queue access so they can claim new chats.
  const PRIVILEGED_ROLES = ['admin', 'colaborador', 'user'];
  const isPrivileged = isAdmin || PRIVILEGED_ROLES.includes(user?.role || '');
  const restrictOpenToMine = !isPrivileged;
  const isVisibleByOpenScope = React.useCallback(
    (contactId: string) => {
      if (!restrictOpenToMine) return true;
      const status = statusByContact.get(contactId);
      if (status !== 'open') return true;
      const assigned = convMetaByContact.get(contactId)?.assignedTo;
      if (!assigned) return false;
      return assigned === String(user?.id) || assigned === user?.name;
    },
    [restrictOpenToMine, statusByContact, convMetaByContact, user?.id, user?.name]
  );

  // Defer search input so that fast typing does not block list/count derivation.
  const deferredSearch = React.useDeferredValue(searchQuery);

  // Base list for tab badges — ignores `conversationStatusFilter` so that both
  // "Em Abertos" and "Em Atendimento" badges always show their real values
  // regardless of which tab is currently selected. Applies all OTHER filters
  // (Individual/Grupos tab, search, owner, period, stage, sla, mode).
  // Snoozed contacts are hidden to match the context's default behavior.
  const baseForCounts = React.useMemo(() => {
    const now = Date.now();
    const snoozedContactIds = new Set(
      conversations
        .filter((c) => {
          const conv = c as { snoozed_until?: string | null };
          return conv.snoozed_until && new Date(conv.snoozed_until).getTime() > now;
        })
        .map((c) => c.contact_id)
    );
    const q = deferredSearch.trim().toLowerCase();
    const base = contacts.filter((c) => {
      if (snoozedContactIds.has(c.id)) return false;
      if (!matchesActiveTab(c.id)) return false;
      if (q) {
        const matches =
          (c.name || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
    return applyClientFilters(base).filter((c) => isVisibleByOpenScope(c.id));
  }, [contacts, conversations, deferredSearch, matchesActiveTab, applyClientFilters, isVisibleByOpenScope]);

  // Single pass over the count base — produces both counts in the same render
  // tick. Counts now reflect filters but NOT the active status tab, so each
  // badge always displays its true value.
  // ─────────────────────────────────────────────────────────────────────
  // Totalizers — counted directly over the FULL `conversations` universe
  // (loaded server-side without contact pagination), so badges reflect the
  // real total of pending/open tickets matching the active filters,
  // regardless of how many contacts were already paginated into the list.
  // ─────────────────────────────────────────────────────────────────────
  const { pendingConvCount, openConvCount } = React.useMemo(() => {
    let pending = 0;
    let open = 0;

    // Pre-build helpers
    const contactById = new Map<string, typeof contacts[number]>();
    contacts.forEach((c) => contactById.set(c.id, c));

    const q = deferredSearch.trim().toLowerCase();
    const range = getDateRange(periodFilter);
    const selectedMember =
      ownerFilter !== 'all' && ownerFilter !== 'mine' && ownerFilter !== 'unassigned'
        ? teamMembers.find((m) => String(m.id) === ownerFilter)
        : undefined;
    const now = Date.now();

    for (const conv of conversations) {
      // Status must be pending/open
      if (conv.status !== 'pending' && conv.status !== 'open') continue;

      // Snooze filter (always hidden by default in the list)
      const snoozedUntil = (conv as { snoozed_until?: string | null }).snoozed_until;
      if (snoozedUntil && new Date(snoozedUntil).getTime() > now) continue;

      // Tab Individual / Grupos
      if (!matchesActiveTab(conv.contact_id)) continue;

      // Open-scope restriction (non-privileged users only see their own open)
      if (!isVisibleByOpenScope(conv.contact_id)) continue;

      // Period filter — use conversation.updated_at as activity proxy
      if (range) {
        const ts = conv.updated_at || conv.created_at;
        if (!ts) continue;
        const d = new Date(ts);
        if (Number.isNaN(d.getTime()) || d < range.from || d > range.to) continue;
      }

      // Owner filter
      if (ownerFilter !== 'all') {
        const assigned = conv.assigned_to;
        if (ownerFilter === 'unassigned') {
          if (assigned) continue;
        } else if (ownerFilter === 'mine') {
          if (!assigned) continue;
          if (assigned !== String(user?.id) && assigned !== user?.name) continue;
        } else {
          if (!assigned) continue;
          if (assigned !== ownerFilter && (!selectedMember || assigned !== selectedMember.name)) continue;
        }
      }

      // Stage filter (by contact phone)
      if (stageIds.length > 0 && stageByPhone) {
        const contact = contactById.get(conv.contact_id);
        const norm = (contact?.phone || '').replace(/\D/g, '');
        const info = norm ? stageByPhone.get(norm) : undefined;
        if (!info || !stageIds.includes(info.stageId)) continue;
      }

      // Mode filter (Julia/humano)
      if (modeFilter !== 'all') {
        if (getConversationMode(conv) !== modeFilter) continue;
      }

      // Search filter — match against the contact's name/phone if loaded
      if (q) {
        const contact = contactById.get(conv.contact_id);
        const name = (contact?.name || '').toLowerCase();
        const phone = (contact?.phone || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q)) continue;
      }

      // Classificação efetiva: conversa com responsável conta como "Em Atendimento"
      // mesmo quando o status físico ainda for 'pending' (camada de segurança
      // contra atrasos do trigger/realtime).
      const hasAssignee = !!(conv.assigned_to && String(conv.assigned_to).trim() !== '');
      const effectiveStatus = conv.status === 'pending' && hasAssignee ? 'open' : conv.status;
      if (effectiveStatus === 'pending') pending++;
      else open++;
    }

    return { pendingConvCount: pending, openConvCount: open };
  }, [
    conversations, contacts, deferredSearch, periodFilter, ownerFilter, teamMembers,
    user?.id, user?.name, stageIds, stageByPhone,
    modeFilter, getConversationMode, matchesActiveTab, isVisibleByOpenScope,
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // Visible list — derived from the SAME `conversations` universe and
  // SAME predicates used by the badges above. Guarantees that whatever
  // the badges count is exactly what the user sees in the list.
  //
  // Strategy:
  //  • For pending/open status filters: walk sortedConversations, keep
  //    only those whose effective status matches the active tab AND that
  //    pass every filter, then dedupe by contact_id.
  //  • For 'all' / resolved / closed: fall back to the legacy contact
  //    based filter (filteredContacts already restricts by status).
  // ─────────────────────────────────────────────────────────────────────
  const { visibleContacts, missingContactIds } = React.useMemo(() => {
    if (conversationStatusFilter !== 'pending' && conversationStatusFilter !== 'open') {
      return {
        visibleContacts: applyClientFilters(filteredContacts).filter((c) => isVisibleByOpenScope(c.id)),
        missingContactIds: [] as string[],
      };
    }

    const contactById = new Map<string, typeof contacts[number]>();
    contacts.forEach((c) => contactById.set(c.id, c));

    const q = deferredSearch.trim().toLowerCase();
    const range = getDateRange(periodFilter);
    const selectedMember =
      ownerFilter !== 'all' && ownerFilter !== 'mine' && ownerFilter !== 'unassigned'
        ? teamMembers.find((m) => String(m.id) === ownerFilter)
        : undefined;
    const now = Date.now();

    const seen = new Set<string>();
    const list: typeof contacts = [];
    const missing: string[] = [];

    for (const conv of sortedConversations) {
      if (conv.status !== 'pending' && conv.status !== 'open') continue;
      if (seen.has(conv.contact_id)) continue;

      // Effective status (pending+assignee → open)
      const hasAssignee = !!(conv.assigned_to && String(conv.assigned_to).trim() !== '');
      const effectiveStatus = conv.status === 'pending' && hasAssignee ? 'open' : conv.status;
      if (effectiveStatus !== conversationStatusFilter) continue;

      // Snooze
      const snoozedUntil = (conv as { snoozed_until?: string | null }).snoozed_until;
      if (snoozedUntil && new Date(snoozedUntil).getTime() > now) continue;

      if (!matchesActiveTab(conv.contact_id)) continue;
      if (!isVisibleByOpenScope(conv.contact_id)) continue;

      // Period
      if (range) {
        const ts = conv.updated_at || conv.created_at;
        if (!ts) continue;
        const d = new Date(ts);
        if (Number.isNaN(d.getTime()) || d < range.from || d > range.to) continue;
      }

      // Owner
      if (ownerFilter !== 'all') {
        const assigned = conv.assigned_to;
        if (ownerFilter === 'unassigned') {
          if (assigned) continue;
        } else if (ownerFilter === 'mine') {
          if (!assigned) continue;
          if (assigned !== String(user?.id) && assigned !== user?.name) continue;
        } else {
          if (!assigned) continue;
          if (assigned !== ownerFilter && (!selectedMember || assigned !== selectedMember.name)) continue;
        }
      }

      const contact = contactById.get(conv.contact_id);

      // Stage
      if (stageIds.length > 0 && stageByPhone) {
        const norm = (contact?.phone || '').replace(/\D/g, '');
        const info = norm ? stageByPhone.get(norm) : undefined;
        if (!info || !stageIds.includes(info.stageId)) continue;
      }

      // Mode (Julia / humano)
      if (modeFilter !== 'all') {
        if (getConversationMode(conv) !== modeFilter) continue;
      }

      // Search
      if (q) {
        const name = (contact?.name || '').toLowerCase();
        const phone = (contact?.phone || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q)) continue;
      }

      seen.add(conv.contact_id);
      if (contact) {
        list.push(contact);
      } else {
        missing.push(conv.contact_id);
      }
    }

    return { visibleContacts: list, missingContactIds: missing };
  }, [
    conversationStatusFilter, sortedConversations, contacts, deferredSearch,
    periodFilter, ownerFilter, teamMembers, user?.id, user?.name,
    stageIds, stageByPhone, modeFilter,
    getConversationMode, matchesActiveTab, isVisibleByOpenScope,
    applyClientFilters, filteredContacts,
  ]);

  // Fetch contacts not yet in the local cache (matched the filters but
  // were beyond the current contact pagination window).
  const { data: fetchedMissing = [] } = useChatContactsByIds(missingContactIds);

  const finalVisibleContacts = React.useMemo(() => {
    if (fetchedMissing.length === 0) return visibleContacts;
    const byId = new Map(visibleContacts.map((c) => [c.id, c]));
    fetchedMissing.forEach((c) => { if (!byId.has(c.id)) byId.set(c.id, c); });
    // Preserve original order (sortedConversations order) — re-sort by
    // the convsByContact map order which already follows desc updated_at.
    return Array.from(byId.values()).sort((a, b) => {
      const aTs = Date.parse(a.last_message_at || a.updated_at || '') || 0;
      const bTs = Date.parse(b.last_message_at || b.updated_at || '') || 0;
      return sortOrder === 'oldest' ? aTs - bTs : bTs - aTs;
    });
  }, [visibleContacts, fetchedMissing, sortOrder]);

  // Virtual scroll — only renders items in the visible viewport.
  // estimateSize ≈ base item height (3 info rows + tags). measureElement
  // corrects actual heights so taller items (with tags) still display correctly.
  const rowVirtualizer = useVirtualizer({
    count: finalVisibleContacts.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 102,
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const channelBadge = (type: string) => {
    switch (type) {
      case 'uazapi': return <Badge variant="outline" className="text-[10px] px-1 text-emerald-600 border-emerald-300">WhatsApp</Badge>;
      case 'waba': return <Badge variant="outline" className="text-[10px] px-1 text-emerald-700 border-emerald-400">WABA</Badge>;
      case 'webchat': return <Badge variant="outline" className="text-[10px] px-1 text-blue-600 border-blue-300">WebChat</Badge>;
      case 'instagram': return <Badge variant="outline" className="text-[10px] px-1 text-pink-600 border-pink-300">Instagram</Badge>;
      default: return <Badge variant="outline" className="text-[10px] px-1">{type}</Badge>;
    }
  };

  return (
    <div className="h-full w-full min-w-0 flex flex-col bg-background overflow-hidden">
      {/* Header - Helena style */}
      <div className="border-b">
        {/* Status pills row */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-1" />
        </div>
        <TagsManagerDialog open={showTagsManager} onOpenChange={setShowTagsManager} />

        {/* Search bar with filter icons */}
        <div className="px-4 pb-2">
          <div className="relative flex items-center gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atendimento"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-muted/40 border-0"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  title="Ordenar conversas"
                >
                  <ArrowDownUp className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-1">
                <button
                  type="button"
                  onClick={() => setSortOrder('newest')}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-muted text-left',
                    sortOrder === 'newest' && 'bg-muted font-medium'
                  )}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  Mais recentes primeiro
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder('oldest')}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-muted text-left',
                    sortOrder === 'oldest' && 'bg-muted font-medium'
                  )}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  Mais antigas primeiro
                </button>
              </PopoverContent>
            </Popover>
            {(isAdmin || user?.role === 'user' || user?.role === 'colaborador') && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={() => navigate('/chat/metricas')}
                  title="Métricas"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={() => navigate('/chat/configuracoes')}
                  title="Configurações do chat"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Período (pills) - sempre visível, fora do painel de filtros */}
        <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriodFilter(opt.value)}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border transition-colors',
                periodFilter === opt.value
                  ? 'bg-foreground/10 text-foreground border-foreground/20'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Linha: Filas + Atendentes lado a lado */}
        <div className="px-4 pb-2 grid grid-cols-2 gap-2">
          {activeQueues.length > 0 ? (
            <Select
              value={selectedQueue?.id || '__all__'}
              onValueChange={(val) => {
                if (val === '__all__') { setSelectedQueue(null); return; }
                const queue = activeQueues.find(q => q.id === val);
                if (queue) {
                  setSelectedQueue({
                    id: queue.id,
                    name: queue.name,
                    channel_type: queue.channel_type,
                    hub: queue.hub,
                    evo_url: queue.evo_url,
                    evo_apikey: queue.evo_apikey,
                    evo_instance: queue.evo_instance,
                  });
                }
              }}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Todas as filas" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  <div className="flex items-center gap-2"><span>Todas as filas</span></div>
                </SelectItem>
                {activeQueues.map((queue) => (
                  <SelectItem key={queue.id} value={queue.id}>
                    <div className="flex items-center gap-2">
                      <span>{queue.name}</span>
                      {channelBadge(queue.channel_type)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : <div />}
          <TeamMemberSelect
            members={teamMembers}
            valueKey="id"
            value={ownerFilter}
            onValueChange={(v) => setOwnerFilter(v ?? 'all')}
            allowUnassigned={false}
            extraOptions={[
              { value: 'all', label: 'Todos atendentes', icon: Users },
              { value: 'mine', label: 'Meus atendimentos', icon: UserCheck, badgeLabel: 'EU' },
              { value: 'unassigned', label: 'Sem atendente', icon: UserX },
            ]}
            placeholder="Atendente"
            size="sm"
            className="w-full text-xs"
          />
        </div>

        {/* Linha destaque: Modo (icones) + Etapas */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 p-2 rounded-md border border-primary/30 bg-primary/5">
            <TooltipProvider delayDuration={200}>
              <ToggleGroup
                type="single"
                value={modeFilter}
                onValueChange={(val) => { if (val) setModeFilter(val as ConversationModeFilter); }}
                size="sm"
                className="justify-start gap-1 shrink-0"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value="all"
                      aria-label="Todos os modos"
                      className="h-8 w-8 p-0 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted data-[state=on]:bg-foreground/10 data-[state=on]:text-foreground data-[state=on]:border-foreground/30"
                    >
                      <ListFilter className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Todos os modos</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value="julia"
                      aria-label="Julia IA ativa"
                      className="h-8 w-8 p-0 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted data-[state=on]:bg-green-500/15 data-[state=on]:text-green-600 dark:data-[state=on]:text-green-400 data-[state=on]:border-green-500/40"
                    >
                      <Bot className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Filas com Julia IA ativa</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value="human"
                      aria-label="Atendimento humano"
                      className="h-8 w-8 p-0 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-600 dark:data-[state=on]:text-amber-400 data-[state=on]:border-amber-500/40"
                    >
                      <User className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Atendimento humano (Julia inativa)</TooltipContent>
                </Tooltip>
              </ToggleGroup>

              <Popover open={stagePopoverOpen} onOpenChange={setStagePopoverOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="h-8 flex-1 justify-between text-xs font-normal bg-background"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{stageLabel}</span>
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Filtrar por etapas do CRM Julia</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <div className="px-2 py-1.5 border-b">
                    <button
                      onClick={toggleAllStages}
                      className="flex items-center gap-2 w-full text-xs hover:bg-accent rounded px-2 py-1.5"
                    >
                      <Checkbox checked={allStagesSelected} className="pointer-events-none" />
                      <span className="font-medium">{allStagesSelected ? 'Desmarcar todas' : 'Selecionar todas'}</span>
                    </button>
                  </div>
                  <ScrollArea className="max-h-[260px]">
                    <div className="p-1">
                      {stages.length === 0 ? (
                        <div className="text-xs text-muted-foreground px-3 py-4 text-center">
                          Nenhuma etapa disponível
                        </div>
                      ) : (
                        stages.map((stage) => (
                          <button
                            key={stage.id}
                            onClick={() => toggleStage(stage.id)}
                            className="flex items-center gap-2 w-full text-xs hover:bg-accent rounded px-2 py-1.5 text-left"
                          >
                            <Checkbox checked={stageSet.has(stage.id)} className="pointer-events-none" />
                            {stage.color && (
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: stage.color }}
                              />
                            )}
                            <span className="truncate">{stage.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </TooltipProvider>
          </div>
        </div>


        {/* Individual / Groups toggle (Groups only when enabled) */}
        {showGroupsTab && (
        <div className="flex border-t">
          {[
            { value: 'individual' as const, label: 'Individual', icon: <MessageCircle className="h-3 w-3" />, count: individualUnreadCount },
            { value: 'groups' as const, label: 'Grupos', icon: <Users className="h-3 w-3" />, count: groupUnreadCount },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium border-b-2 transition-colors',
                activeTab === tab.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className="text-[9px] bg-primary text-primary-foreground rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Status tabs — Aguardando Atendimento / Em Atendimento */}
      <div className="flex border-b shrink-0">
        {([
          { value: 'pending', label: 'Em Abertos', count: pendingConvCount },
          { value: 'open',    label: 'Em Atendimento', count: openConvCount },
        ] as const).map(tab => (
          <button
            key={tab.value}
            onClick={() => setConversationStatusFilter(tab.value)}
            className={cn(
              'flex-1 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center justify-center gap-1.5',
              conversationStatusFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            <span className={cn(
              'rounded-full min-w-[18px] h-4 flex items-center justify-center px-1 text-[9px] font-bold',
              conversationStatusFilter === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}>
              {tab.count >= 99 ? '99+' : tab.count}
            </span>
          </button>
        ))}
      </div>
      {/* Invisible sentinel — triggers loadMoreConversations to keep counts accurate */}
      <div ref={convSentinelRef} className="h-0 w-full" />

      {/* Contact List */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {/* Silent-refetch banner — shown when reloading but the list is
            already populated, so the user doesn't lose the current view. */}
        {isLoading && contacts.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-1.5 text-[10px] text-muted-foreground bg-muted/30 border-b">
            <Loader2 className="h-3 w-3 animate-spin" />
            Atualizando…
          </div>
        )}
        {isLoading && contacts.length === 0 ? (
          <div className="py-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : finalVisibleContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium">Nenhuma conversa</p>
            <p className="text-sm mt-1">
              {slaFilter !== 'all'
                ? slaFilter === 'breached'
                  ? 'Nenhum ticket com SLA estourado'
                  : 'Nenhum ticket com SLA em risco'
                : searchQuery
                  ? 'Tente uma busca diferente'
                  : 'As mensagens aparecerão aqui quando recebidas'}
            </p>
          </div>
        ) : (
          <div
            style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const contact = finalVisibleContacts[virtualItem.index];
              const contactConvs = convsByContact.get(contact.id) || [];
              const conv = contactConvs[0];
              const queueIdToShow = conv?.queue_id || contactConvs.find(c => c.queue_id)?.queue_id;
              const convQueue = queueIdToShow ? activeQueues.find(q => q.id === queueIdToShow) : undefined;
              const queueLink = queueIdToShow ? queueAgentMap?.get(queueIdToShow) : undefined;
              const agentCodAgent = queueLink?.hasAgent ? queueLink.codAgent : null;
              const agentAlias = agentCodAgent
                ? (aliasMap.get(agentCodAgent) || agentBusinessNameMap.get(agentCodAgent) || null)
                : null;
              const normPhone = (contact.phone || '').replace(/\D/g, '');
              const stageInfo = normPhone ? stageByPhone?.get(normPhone) : undefined;
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <ChatContactItem
                    contact={contact}
                    isSelected={contact.id === selectedContactId}
                    onClick={() => selectContact(contact.id)}
                    conversation={conv}
                    queueName={convQueue?.name}
                    assignedAgentName={conv?.assigned_to || undefined}
                    index={virtualItem.index}
                    convTags={conv ? (conversationTagsMap?.[conv.id] || []) : undefined}
                    agentCodAgent={agentCodAgent}
                    agentAlias={agentAlias}
                    stageName={queueLink?.hasAgent ? stageInfo?.stageName : undefined}
                    stageColor={queueLink?.hasAgent ? stageInfo?.stageColor : undefined}
                    hasCrmCard={conv?.id ? !!crmBuilderMap?.has(conv.id) : false}
                    crmBuilderLink={conv?.id ? crmBuilderMap?.get(conv.id) : undefined}
                    lastMessageMeta={conv ? getLastMsgMeta(conv.id) : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Infinite scroll loader / sentinel */}
        {isLoadingMoreContacts && contacts.length > 0 && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {finalVisibleContacts.length > 0 && (
          <div ref={bottomSentinelRef} className="h-1" />
        )}
        {hasMoreContacts && !isLoadingMoreContacts && finalVisibleContacts.length > 0 && (
          <div className="flex justify-center py-3">
            <button
              type="button"
              onClick={() => loadMoreContacts()}
              className="text-xs text-primary hover:underline"
            >
              Carregar mais conversas
            </button>
          </div>
        )}
        {!isLoading && !hasMoreContacts && finalVisibleContacts.length > 0 && (
          <div className="text-center text-[10px] text-muted-foreground py-3">
            Fim da lista
          </div>
        )}
      </div>

      {/* Footer: iniciar nova conversa */}
      <div className="px-3 py-2 border-t bg-muted/30 shrink-0">
        <p className="text-[10px] text-muted-foreground mb-1.5">Iniciar nova conversa</p>
        <div className="flex items-center gap-1.5">
          <Select value={footerCountry} onValueChange={setFooterCountry}>
            <SelectTrigger className="h-8 w-[72px] text-xs shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="55" className="text-xs">+55</SelectItem>
              <SelectItem value="1" className="text-xs">+1</SelectItem>
              <SelectItem value="351" className="text-xs">+351</SelectItem>
              <SelectItem value="54" className="text-xs">+54</SelectItem>
              <SelectItem value="56" className="text-xs">+56</SelectItem>
            </SelectContent>
          </Select>
          <input
            value={footerPhone}
            onChange={e => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
              let fmt = digits;
              if (digits.length > 2 && digits.length <= 6) fmt = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
              else if (digits.length > 6 && digits.length <= 10) fmt = `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
              else if (digits.length > 10) fmt = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
              setFooterPhone(fmt);
            }}
            placeholder="(00) 00000-0000"
            className="h-8 text-xs flex-1 rounded-md border border-input bg-background px-3 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            size="sm"
            className="h-8 text-xs px-3 shrink-0"
            disabled={footerPhone.replace(/\D/g,'').length < 10}
            onClick={() => setNewConvOpen(true)}
          >
            <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
            Conversar
          </Button>
        </div>
      </div>

      <NewConversationDialog
        open={newConvOpen}
        onOpenChange={(v) => { setNewConvOpen(v); if (!v) setFooterPhone(''); }}
        queues={activeQueues.filter(q => q.channel_type === 'uazapi')}
        initialPhone={footerCountry + footerPhone.replace(/\D/g,'')}
      />
    </div>
  );
}
