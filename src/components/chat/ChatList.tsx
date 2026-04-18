import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Search, MessageCircle, Users, Clock, CheckCircle2, Inbox, Settings2, BarChart3, Layers, Filter, ArrowUpDown, Plus, Timer, AlertTriangle, Flame } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { ChatContactItem } from './ChatContactItem';
import { Badge } from '@/components/ui/badge';
import { useQueues } from '@/pages/agente/filas/hooks/useQueues';
import { useChatSlaConfigs, evaluateSla, type SlaStatus } from '@/hooks/useChatSlaConfigs';
import type { ConversationFilterStatus } from '@/types/conversation';
import { cn } from '@/lib/utils';

type SlaFilter = 'all' | 'breached' | 'at_risk';

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
  } = useWhatsAppData();

  const navigate = useNavigate();
  const { data: queues = [] } = useQueues();
  const { configs: slaConfigs } = useChatSlaConfigs();
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('all');

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

  const visibleContacts = React.useMemo(() => {
    if (slaFilter === 'all') return filteredContacts;
    return filteredContacts.filter((c) => slaStatusByContact.get(c.id) === slaFilter);
  }, [filteredContacts, slaFilter, slaStatusByContact]);

  // Count conversations by status
  const pendingCount = conversations.filter(c => c.status === 'pending').length;
  const openCount = conversations.filter(c => c.status === 'open').length;
  const resolvedCount = conversations.filter(c => c.status === 'resolved').length;

  const statusPills: { value: ConversationFilterStatus; label: string; count?: number; color: string }[] = [
    { value: 'pending', label: 'Novos', count: pendingCount, color: 'bg-red-500' },
    { value: 'open', label: 'Meus', count: openCount, color: 'bg-blue-500' },
    { value: 'resolved', label: 'Outros', count: resolvedCount, color: 'bg-muted-foreground' },
  ];

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
          <button
            onClick={() => setConversationStatusFilter('all')}
            className={cn(
              'text-sm font-medium transition-colors',
              conversationStatusFilter === 'all' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Todas
          </button>
          {statusPills.map(pill => (
            <button
              key={pill.value}
              onClick={() => setConversationStatusFilter(pill.value)}
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium transition-colors',
                conversationStatusFilter === pill.value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {pill.label}
              {pill.count !== undefined && pill.count > 0 && (
                <span className={cn('text-[10px] text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold', pill.color)}>
                  {pill.count}
                </span>
              )}
            </button>
          ))}

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/chat/metricas')} title="Métricas">
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/chat/automacoes')} title="Automações">
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/chat/canais')} title="Canais">
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/chat/sla')} title="Configurar SLA">
              <Timer className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => syncContacts()} disabled={isSyncing || !selectedQueue} title="Sincronizar">
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
            </Button>
          </div>
        </div>

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
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
              <ArrowUpDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* SLA quick filters */}
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

        {/* Individual / Groups toggle */}
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
      </div>

      {/* Contact List */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : visibleContacts.length === 0 ? (
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
            visibleContacts.map((contact) => {
              // Pick most recent conversation (any status) so queue/team stay visible
              const contactConvs = conversations
                .filter(c => c.contact_id === contact.id)
                .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
              const conv = contactConvs[0];
              // Fallback: if current conversation has no queue, look for the most recent prior conversation that has one
              const queueIdToShow = conv?.queue_id || contactConvs.find(c => c.queue_id)?.queue_id;
              const convQueue = queueIdToShow ? activeQueues.find(q => q.id === queueIdToShow) : undefined;
              return (
                <ChatContactItem
                  key={contact.id}
                  contact={contact}
                  isSelected={contact.id === selectedContactId}
                  onClick={() => selectContact(contact.id)}
                  conversation={conv}
                  queueName={convQueue?.name}
                  assignedAgentName={conv?.assigned_to || undefined}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
