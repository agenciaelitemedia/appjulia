import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Search, MessageCircle, Users, Bot, Clock, CheckCircle2, Inbox, Globe, Instagram, Settings2 } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { ChatContactItem } from './ChatContactItem';
import { Badge } from '@/components/ui/badge';
import { useMyAgents } from '@/pages/agente/meus-agentes/hooks/useMyAgents';
import type { ConversationFilterStatus } from '@/types/conversation';

type ChannelFilter = 'all' | 'whatsapp_uazapi' | 'whatsapp_waba' | 'webchat' | 'instagram';

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
    selectedAgent,
    setSelectedAgent,
    conversationStatusFilter,
    setConversationStatusFilter,
    conversations,
  } = useWhatsAppData();

  const { data: agentsData } = useMyAgents();
  const [channelFilter, setChannelFilter] = React.useState<ChannelFilter>('all');
  
  const allAgents = [
    ...(agentsData?.myAgents || []),
    ...(agentsData?.monitoredAgents || []),
  ].filter(a => a.hub);

  useEffect(() => {
    if (!selectedAgent && allAgents.length > 0) {
      const first = allAgents[0];
      setSelectedAgent({
        cod_agent: first.cod_agent,
        hub: first.hub as 'uazapi' | 'waba',
        name: first.business_name || first.client_name || first.cod_agent,
      });
    }
  }, [allAgents.length, selectedAgent, setSelectedAgent]);

  // Count conversations by status
  const pendingCount = conversations.filter(c => c.status === 'pending').length;
  const openCount = conversations.filter(c => c.status === 'open').length;

  const statusFilters: { value: ConversationFilterStatus; label: string; icon: React.ReactNode; count?: number }[] = [
    { value: 'all', label: 'Todas', icon: <Inbox className="h-3 w-3" /> },
    { value: 'pending', label: 'Pendentes', icon: <Clock className="h-3 w-3" />, count: pendingCount },
    { value: 'open', label: 'Abertas', icon: <MessageCircle className="h-3 w-3" />, count: openCount },
    { value: 'resolved', label: 'Resolvidas', icon: <CheckCircle2 className="h-3 w-3" /> },
  ];

  const channelFilters: { value: ChannelFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'Todos', icon: <Inbox className="h-3 w-3" /> },
    { value: 'whatsapp_uazapi', label: 'WA', icon: <MessageCircle className="h-3 w-3 text-emerald-500" /> },
    { value: 'whatsapp_waba', label: 'WABA', icon: <MessageCircle className="h-3 w-3 text-emerald-600" /> },
    { value: 'webchat', label: 'Web', icon: <Globe className="h-3 w-3 text-blue-500" /> },
    { value: 'instagram', label: 'IG', icon: <Instagram className="h-3 w-3 text-pink-500" /> },
  ];

  // Apply channel filter to contacts
  const channelFilteredContacts = React.useMemo(() => {
    if (channelFilter === 'all') return filteredContacts;
    return filteredContacts.filter(contact => {
      const conv = conversations.find(c => c.contact_id === contact.id && ['pending', 'open'].includes(c.status));
      return conv?.channel === channelFilter;
    });
  }, [filteredContacts, conversations, channelFilter]);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Conversas
            {totalUnreadCount > 0 && (
              <Badge variant="default" className="text-xs">
                {totalUnreadCount}
              </Badge>
            )}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => syncContacts()}
            disabled={isSyncing || !selectedAgent}
            title="Sincronizar contatos"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Agent selector */}
        {allAgents.length > 0 && (
          <Select
            value={selectedAgent?.cod_agent || ''}
            onValueChange={(val) => {
              const agent = allAgents.find(a => a.cod_agent === val);
              if (agent) {
                setSelectedAgent({
                  cod_agent: agent.cod_agent,
                  hub: agent.hub as 'uazapi' | 'waba',
                  name: agent.business_name || agent.client_name || agent.cod_agent,
                });
              }
            }}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Selecionar agente..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              {allAgents.map((agent) => (
                <SelectItem key={agent.cod_agent} value={agent.cod_agent}>
                  <div className="flex items-center gap-2">
                    <span>{agent.business_name || agent.client_name || agent.cod_agent}</span>
                    <Badge variant="outline" className="text-[10px] px-1">
                      {agent.hub === 'waba' ? 'API Oficial' : 'UaZapi'}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Conversation status filters */}
        <div className="flex gap-1">
          {statusFilters.map(f => (
            <Button
              key={f.value}
              variant={conversationStatusFilter === f.value ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs flex-1 gap-1"
              onClick={() => setConversationStatusFilter(f.value)}
            >
              {f.icon}
              {f.label}
              {f.count !== undefined && f.count > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1 h-4 ml-0.5">
                  {f.count}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Channel filters */}
        <div className="flex gap-1">
          {channelFilters.map(f => (
            <Button
              key={f.value}
              variant={channelFilter === f.value ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 text-[10px] flex-1 gap-0.5 px-1"
              onClick={() => setChannelFilter(f.value)}
            >
              {f.icon}
              {f.label}
            </Button>
          ))}
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all" className="text-xs">
              Todas
              {totalUnreadCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                  {totalUnreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="individual" className="text-xs">
              <MessageCircle className="h-3 w-3 mr-1" />
              Individual
              {individualUnreadCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                  {individualUnreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="groups" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              Grupos
              {groupUnreadCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                  {groupUnreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Contact List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {!selectedAgent ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Bot className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">Selecione um agente</p>
              <p className="text-sm mt-1">Escolha um agente acima para ver as conversas</p>
            </div>
          ) : isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : channelFilteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">Nenhuma conversa</p>
              <p className="text-sm mt-1">
                {searchQuery 
                  ? 'Tente uma busca diferente'
                  : 'Clique em sincronizar para carregar'}
              </p>
            </div>
          ) : (
            channelFilteredContacts.map((contact) => (
              <ChatContactItem
                key={contact.id}
                contact={contact}
                isSelected={contact.id === selectedContactId}
                onClick={() => selectContact(contact.id)}
                conversation={conversations.find(c => c.contact_id === contact.id && ['pending', 'open'].includes(c.status))}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}