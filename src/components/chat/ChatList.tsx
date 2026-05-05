import React, { useEffect, useRef, useState } from 'react';
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
import { RefreshCw, Search, MessageCircle, Users, Clock, CheckCircle2, Inbox, Settings2, BarChart3, Layers, Filter, Plus, Timer, AlertTriangle, Flame, Bot, User, UserCheck, UserX, ListFilter, FolderOpen, CheckCheck, Archive, UserCircle, ChevronsUpDown, CalendarDays, Tag, Settings } from 'lucide-react';
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
import { useQueueAgentLinks } from '@/hooks/useQueueAgentLink';
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

type SlaFilter = 'all' | 'breached' | 'at_risk';
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
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('all');
  const [modeFilter, setModeFilter] = useState<ConversationModeFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [stageIds, setStageIds] = useState<number[]>([]);
  const [stagePopoverOpen, setStagePopoverOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const activeFilterCount =
    (modeFilter !== 'all' ? 1 : 0) +
    (slaFilter !== 'all' ? 1 : 0) +
    (ownerFilter !== 'all' ? 1 : 0) +
    (conversationStatusFilter !== 'all' ? 1 : 0) +
    (periodFilter !== 'all' ? 1 : 0) +
    (stageIds.length > 0 ? 1 : 0);

  const activeQueues = queues.filter(q => q.is_active && !q.is_deleted);

  // Default = "Todas as filas" (selectedQueue null). No auto-select.

  // SLA status per contact (worst across that contact's open conversations)
  const slaStatusByContact = React.useMemo(() => {
    const map = new Map<string, SlaStatus>();
    const rank: Record<SlaStatus, number> = { breached: 3, at_risk: 2, on_track: 1, unknown: 0 };
    conversations.forEach((conv) => {
      if (!['pending', 'open'].includes(conv.status)) return;
      const evalRes = evaluateSla(
        {
          status: conv.status,
          priority: conv.priority,
          opened_at: conv.opened_at,
          first_response_at: conv.first_response_at || null,
          resolved_at: conv.resolved_at || null,
          closed_at: conv.closed_at || null,
        },
        slaConfigs
      );
      const prev = map.get(conv.contact_id);
      if (!prev || rank[evalRes.status] > rank[prev]) {
        map.set(conv.contact_id, evalRes.status);
      }
    });
    return map;
  }, [conversations, slaConfigs]);

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
  const { data: crmLinkedConversationIds } = useCRMBuilderLinkedConversations();

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
      return queueLink?.hasAgent ? 'julia' : 'human';
    },
    [convMetaByContact, queueAgentMap]
  );

  const getConversationMode = React.useCallback(
    (conv: typeof conversations[number]): Exclude<ConversationModeFilter, 'all'> => {
      const queueLink = conv.queue_id ? queueAgentMap?.get(conv.queue_id) : undefined;
      return queueLink?.hasAgent ? 'julia' : 'human';
    },
    [conversations, queueAgentMap]
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
      if (slaFilter !== 'all') {
        result = result.filter((c) => slaStatusByContact.get(c.id) === slaFilter);
      }
      if (modeFilter !== 'all') {
        result = result.filter((c) => getContactMode(c.id) === modeFilter);
      }
      return result;
    },
    [ownerFilter, teamMembers, convMetaByContact, user?.id, user?.name, periodFilter, stageIds, stageByPhone, slaFilter, slaStatusByContact, modeFilter, getContactMode]
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

      // SLA filter
      if (slaFilter !== 'all') {
        if (slaStatusByContact.get(conv.contact_id) !== slaFilter) continue;
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
    user?.id, user?.name, stageIds, stageByPhone, slaFilter, slaStatusByContact,
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

      // SLA
      if (slaFilter !== 'all') {
        if (slaStatusByContact.get(conv.contact_id) !== slaFilter) continue;
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
    stageIds, stageByPhone, slaFilter, slaStatusByContact, modeFilter,
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
      return bTs - aTs;
    });
  }, [visibleContacts, fetchedMissing]);

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
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-9 w-9 flex-shrink-0 relative',
                filtersOpen && 'bg-muted text-foreground'
              )}
              onClick={() => setFiltersOpen((v) => !v)}
              title="Filtros"
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
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

        {filtersOpen && (
        <>
        {(breachedCount > 0 || atRiskCount > 0 || slaFilter !== 'all') && (
          <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSlaFilter('all')}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border transition-colors',
                slaFilter === 'all'
                  ? 'bg-foreground/10 text-foreground border-foreground/20'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
              )}
            >
              Todos SLAs
            </button>
            <button
              onClick={() => setSlaFilter(slaFilter === 'breached' ? 'all' : 'breached')}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border transition-colors',
                slaFilter === 'breached'
                  ? 'bg-destructive/15 text-destructive border-destructive/30'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
              )}
              title="Mostrar apenas tickets com SLA estourado"
            >
              <Flame className="h-3 w-3" />
              Estourado
              {breachedCount > 0 && (
                <span className="ml-0.5 bg-destructive text-destructive-foreground rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] font-bold">
                  {breachedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setSlaFilter(slaFilter === 'at_risk' ? 'all' : 'at_risk')}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border transition-colors',
                slaFilter === 'at_risk'
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
              )}
              title="Mostrar apenas tickets com SLA em risco"
            >
              <AlertTriangle className="h-3 w-3" />
              Em risco
              {atRiskCount > 0 && (
                <span className="ml-0.5 bg-amber-500 text-white rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] font-bold">
                  {atRiskCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Status pills — dentro do painel de filtros, sem contagens */}
        <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
          {([
            { value: 'all',      label: 'Todos',           icon: <ListFilter className="h-3 w-3" />,  active: 'bg-foreground/10 text-foreground border-foreground/20' },
            { value: 'pending',  label: 'Pendentes',       icon: <Clock className="h-3 w-3" />,       active: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
            { value: 'open',     label: 'Em atendimento',  icon: <FolderOpen className="h-3 w-3" />,  active: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
            { value: 'resolved', label: 'Resolvidas',      icon: <CheckCheck className="h-3 w-3" />,  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
            { value: 'closed',   label: 'Encerradas',      icon: <Archive className="h-3 w-3" />,     active: 'bg-foreground/10 text-foreground border-foreground/20' },
          ] as const).map(pill => (
            <button
              key={pill.value}
              onClick={() => setConversationStatusFilter(pill.value)}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border transition-colors',
                conversationStatusFilter === pill.value
                  ? pill.active
                  : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {pill.icon}
              {pill.label}
            </button>
          ))}
        </div>

        {/* Responsável (busca + avatares) */}
        <div className="px-4 pb-2 flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          <TeamMemberSelect
            members={teamMembers}
            valueKey="id"
            value={['all', 'mine', 'unassigned'].includes(ownerFilter) ? ownerFilter : ownerFilter}
            onValueChange={(v) => setOwnerFilter(v ?? 'all')}
            allowUnassigned={false}
            extraOptions={[
              { value: 'all', label: 'Todos atendentes', icon: Users },
              { value: 'mine', label: 'Meus atendimentos', icon: UserCheck, badgeLabel: 'EU' },
              { value: 'unassigned', label: 'Sem atendente', icon: UserX },
            ]}
            placeholder="Responsável"
            size="sm"
            className="w-full text-xs"
          />
        </div>

        {/* Etapas (multi-select) */}
        <div className="px-4 pb-2 flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
          <Popover open={stagePopoverOpen} onOpenChange={setStagePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="h-8 w-full justify-between text-xs font-normal"
              >
                <span className="truncate">{stageLabel}</span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
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
        </div>
        </>
        )}

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

        {/* Queue selector - includes "Todas as filas" option */}
        {activeQueues.length > 0 && (
          <div className="px-4 pb-2">
            <Select
              value={selectedQueue?.id || '__all__'}
              onValueChange={(val) => {
                if (val === '__all__') {
                  setSelectedQueue(null);
                  return;
                }
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
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Todas as filas" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  <div className="flex items-center gap-2">
                    <span>Todas as filas</span>
                  </div>
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
          </div>
        )}

        {/* Filtro Julia / Atendimento Humano — sempre visível, abaixo das filas */}
        <div className="px-4 pb-2 pt-1 flex items-center gap-1.5">
          <ToggleGroup
            type="single"
            value={modeFilter}
            onValueChange={(val) => { if (val) setModeFilter(val as ConversationModeFilter); }}
            size="sm"
            className="justify-start w-full"
          >
            <ToggleGroupItem
              value="all"
              className="flex-1 text-[10px] font-medium px-2 py-1 h-auto rounded-md border border-border bg-transparent text-muted-foreground hover:bg-muted data-[state=on]:bg-foreground/10 data-[state=on]:text-foreground data-[state=on]:border-foreground/20"
            >
              Todos
            </ToggleGroupItem>
            <ToggleGroupItem
              value="julia"
              className="flex-1 text-[10px] font-medium px-2 py-1 h-auto gap-1 rounded-md border border-border bg-transparent text-muted-foreground hover:bg-muted data-[state=on]:bg-green-500/15 data-[state=on]:text-green-600 dark:data-[state=on]:text-green-400 data-[state=on]:border-green-500/30"
              title="Filas com Julia IA ativa"
            >
              <Bot className="h-3 w-3" />
              Julia
            </ToggleGroupItem>
            <ToggleGroupItem
              value="human"
              className="flex-1 text-[10px] font-medium px-2 py-1 h-auto gap-1 rounded-md border border-border bg-transparent text-muted-foreground hover:bg-muted data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-600 dark:data-[state=on]:text-amber-400 data-[state=on]:border-amber-500/30"
              title="Filas com Julia IA inativa (atendimento humano)"
            >
              <User className="h-3 w-3" />
              Atendimento Humano
            </ToggleGroupItem>
          </ToggleGroup>
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
        <div className="py-1">
          {isLoading && contacts.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
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
            finalVisibleContacts.map((contact, idx) => {
              // Pick most recent conversation (any status) so queue/team stay visible.
              // Uses pre-grouped, pre-sorted Map → O(1) per row instead of
              // O(N log N) filter+sort on every render.
              const contactConvs = convsByContact.get(contact.id) || [];
              const conv = contactConvs[0];
              // Fallback: if current conversation has no queue, look for the most recent prior conversation that has one
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
                <ChatContactItem
                  key={contact.id}
                  contact={contact}
                  isSelected={contact.id === selectedContactId}
                  onClick={() => selectContact(contact.id)}
                  conversation={conv}
                  queueName={convQueue?.name}
                  assignedAgentName={conv?.assigned_to || undefined}
                  index={idx}
                  convTags={conv ? (conversationTagsMap?.[conv.id] || []) : undefined}
                  agentCodAgent={agentCodAgent}
                  agentAlias={agentAlias}
                  stageName={queueLink?.hasAgent ? stageInfo?.stageName : undefined}
                  stageColor={queueLink?.hasAgent ? stageInfo?.stageColor : undefined}
                  hasCrmCard={conv?.id ? !!crmLinkedConversationIds?.has(conv.id) : false}
                />
              );
            })
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
          {!isLoading && !hasMoreContacts && finalVisibleContacts.length > 0 && (
            <div className="text-center text-[10px] text-muted-foreground py-3">
              Fim da lista
            </div>
          )}
        </div>
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
