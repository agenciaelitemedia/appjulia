import React, { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Search, MessageCircle, Users, Bot } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { ChatContactItem } from './ChatContactItem';
import { Badge } from '@/components/ui/badge';
import { useMyAgents } from '@/pages/agente/meus-agentes/hooks/useMyAgents';

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
  } = useWhatsAppData();

  const { data: agentsData } = useMyAgents();
  
  // All agents (own + monitored)
  const allAgents = [
    ...(agentsData?.myAgents || []),
    ...(agentsData?.monitoredAgents || []),
  ].filter(a => a.hub); // Only agents with a messaging hub configured

  // Auto-select first agent if none selected
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
          ) : filteredContacts.length === 0 ? (
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
            filteredContacts.map((contact) => (
              <ChatContactItem
                key={contact.id}
                contact={contact}
                isSelected={contact.id === selectedContactId}
                onClick={() => selectContact(contact.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
