import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SmartAvatarImage } from '@/components/chat/SmartAvatarImage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Phone, MessageSquare, Clock, Tag, History, Plus, Hash, Check, Pencil, Info, FileText, Search, Users, UserCheck, Layers } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConversationParticipants } from './ConversationParticipants';
import { PriorityBadge } from './PriorityBadge';
import { ConversationSummaries } from './ConversationSummaries';
import type { ChatContact } from '@/types/chat';
import type { ChatConversation, ConversationHistoryEntry, ChatTag } from '@/types/conversation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useChatSlaConfigs, evaluateSla } from '@/hooks/useChatSlaConfigs';
import { useConversationsLastMessageMeta } from '@/hooks/useConversationsLastMessageMeta';
import { SlaBadge } from './SlaBadge';
import { useCRMStageByPhone } from '@/hooks/useCRMStageByPhone';

// ─── TagSelector ─────────────────────────────────────────────────────────────
interface TagSelectorProps {
  allTags: ChatTag[];
  activeTags: string[];
  onToggle: (tagId: string) => void;
  onCreateAndAdd: () => void;
  newTagName: string;
  onNewTagNameChange: (v: string) => void;
  showAddTag: boolean;
  onToggleAddTag: () => void;
}

function TagSelector({ allTags, activeTags, onToggle, onCreateAndAdd, newTagName, onNewTagNameChange, showAddTag, onToggleAddTag }: TagSelectorProps) {
  const [search, setSearch] = useState('');

  const filtered = allTags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const activeTagObjs = allTags.filter(t => activeTags.includes(t.id));
  const showCreate = search.trim() && !allTags.some(t => t.name.toLowerCase() === search.toLowerCase());

  const handleCreateInline = () => {
    onNewTagNameChange(search.trim());
    // Trigger create via parent after setting name — use a tiny delay
    setTimeout(() => {
      onCreateAndAdd();
      setSearch('');
    }, 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
          <Tag className="h-3 w-3" /> Tags
        </h5>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleAddTag} title="Adicionar tag">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Active tags */}
      {activeTagObjs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activeTagObjs.map(tag => (
            <button
              key={tag.id}
              onClick={() => onToggle(tag.id)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-white hover:opacity-80 transition-opacity"
              style={{ backgroundColor: tag.color }}
              title="Clique para remover"
            >
              {tag.name}
              <X className="h-2.5 w-2.5" />
            </button>
          ))}
        </div>
      )}

      {/* Search & select panel */}
      {showAddTag && (
        <div className="border rounded-md overflow-hidden bg-background">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b">
            <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <input
              className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Buscar ou criar tag..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Escape') onToggleAddTag(); }}
            />
          </div>
          <div className="max-h-[150px] overflow-y-auto py-1">
            {filtered.map(tag => {
              const active = activeTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => onToggle(tag.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted/50 text-left',
                    active && 'bg-muted/30'
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 truncate">{tag.name}</span>
                  {active && <Check className="h-3 w-3 text-primary flex-shrink-0" />}
                </button>
              );
            })}
            {showCreate && (
              <button
                onClick={handleCreateInline}
                className="w-full flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted/50 text-left text-primary"
              >
                <Plus className="h-3 w-3 flex-shrink-0" />
                Criar tag "{search.trim()}"
              </button>
            )}
            {filtered.length === 0 && !showCreate && (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma tag encontrada</p>
            )}
          </div>
        </div>
      )}
      {allTags.length === 0 && !showAddTag && (
        <span className="text-xs text-muted-foreground">Nenhuma tag criada</span>
      )}
    </div>
  );
}

interface ContactDetailPanelProps {
  contact: ChatContact;
  onClose: () => void;
}

const actionLabels: Record<string, (e: ConversationHistoryEntry) => string> = {
  opened:           () => 'abriu a conversa',
  closed:           () => 'encerrou a conversa',
  resolved:         () => 'resolveu a conversa',
  reopened:         () => 'reabriu a conversa',
  assigned:         (e) => `atribuiu para ${e.to_value}`,
  unassigned:       () => 'removeu a atribuição',
  priority_changed: (e) => `alterou prioridade${e.from_value ? ` de ${e.from_value}` : ''} para ${e.to_value}`,
  queue_changed:    (e) => `transferiu para fila ${e.to_value}`,
  transferred:      (e) => `transferiu para ${e.to_value}`,
  status_changed:   (e) => `alterou status para ${e.to_value}`,
  snoozed:          (e) => `adiou a conversa até ${e.to_value}`,
  tag_added:        (e) => `adicionou tag "${e.to_value}"`,
  tag_removed:      (e) => `removeu tag "${e.to_value}"`,
  note_added:       () => 'registrou uma nota interna',
  auto_returned:    (e) => `devolveu automaticamente à fila (responsável ${e.from_value ?? ''} removido por NRT vencido)`,
};

export function ContactDetailPanel({ contact, onClose }: ContactDetailPanelProps) {
  const {
    selectedConversation, tags, createTag, addTagToConversation, removeTagFromConversation,
    conversationHistory, loadConversationHistory,
  } = useWhatsAppData();
  const [newTagName, setNewTagName] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);

  const queryClient = useQueryClient();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(contact.name);

  // Past conversations — cached by React Query, avoids re-fetch on every re-render
  const { data: pastConversations = [] } = useQuery<ChatConversation[]>({
    queryKey: ['contact-past-convs', contact.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []) as ChatConversation[];
    },
    staleTime: 60_000,
  });

  // Tags for the selected conversation — cached and invalidated when selection changes
  const { data: conversationTagsData = [] } = useQuery<string[]>({
    queryKey: ['conv-tags', selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data } = await supabase
        .from('chat_conversation_tags')
        .select('tag_id')
        .eq('conversation_id', selectedConversation.id);
      return (data || []).map((t: any) => t.tag_id);
    },
    enabled: !!selectedConversation?.id,
    staleTime: 30_000,
  });
  const conversationTags = conversationTagsData;

  const { configs: slaConfigs } = useChatSlaConfigs();
  const { getMeta: getLastMsgMeta } = useConversationsLastMessageMeta(
    selectedConversation?.id ? [selectedConversation.id] : [],
  );

  const slaEvaluation = React.useMemo(() => {
    if (!selectedConversation) return null;
    if (['closed', 'resolved'].includes(selectedConversation.status)) return null;
    const meta = getLastMsgMeta(selectedConversation.id);
    return evaluateSla(
      {
        status: selectedConversation.status,
        priority: selectedConversation.priority,
        opened_at: selectedConversation.opened_at,
        first_response_at: selectedConversation.first_response_at || null,
        resolved_at: selectedConversation.resolved_at || null,
        closed_at: selectedConversation.closed_at || null,
        last_customer_message_at: meta.last_customer_message_at,
        last_message_from_me: meta.last_message_from_me,
      },
      slaConfigs
    );
  }, [selectedConversation, slaConfigs, getLastMsgMeta]);

  const queueId = selectedConversation?.queue_id || null;
  const { data: queueName } = useQuery({
    queryKey: ['contact-detail-queue-name', queueId],
    enabled: !!queueId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('queues')
        .select('name')
        .eq('id', queueId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.name as string) || null;
    },
  });

  const stageCodAgent = String(
    (selectedConversation as { cod_agent?: string | number } | undefined)?.cod_agent ??
    (contact as { cod_agent?: string | number }).cod_agent ??
    ''
  ).trim();
  const stagePairs = React.useMemo(
    () => (contact.phone ? [{ phone: contact.phone, codAgent: stageCodAgent || '' }] : []),
    [contact.phone, stageCodAgent]
  );
  const { data: stageMap } = useCRMStageByPhone(stagePairs);
  const juliaStage = React.useMemo(() => {
    if (!stageMap || !contact.phone) return null;
    const norm = contact.phone.replace(/\D/g, '');
    if (!norm) return null;
    if (stageCodAgent) {
      return stageMap.get(`${norm}|${stageCodAgent}`) || stageMap.get(norm) || null;
    }
    return stageMap.get(norm) || null;
  }, [stageMap, contact.phone, stageCodAgent]);

  const initials = contact.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();


  useEffect(() => {
    if (selectedConversation) {
      loadConversationHistory(selectedConversation.id);
    }
  }, [selectedConversation?.id, loadConversationHistory]);

  useEffect(() => {
    setEditName(contact.name);
    setIsEditingName(false);
  }, [contact.id, contact.name]);

  const handleSaveName = async () => {
    if (!editName.trim() || editName.trim() === contact.name) {
      setIsEditingName(false);
      return;
    }
    const { error } = await supabase
      .from('chat_contacts')
      .update({ name: editName.trim() })
      .eq('id', contact.id);

    if (error) {
      toast.error('Erro ao atualizar nome');
    } else {
      toast.success('Nome atualizado');
    }
    setIsEditingName(false);
  };

  const convTagsKey = ['conv-tags', selectedConversation?.id];

  const handleAddTag = async () => {
    if (!newTagName.trim() || !selectedConversation) return;
    const tag = await createTag(newTagName.trim(), '#3b82f6');
    if (tag) {
      await addTagToConversation(selectedConversation.id, tag.id, tag.name);
      queryClient.setQueryData<string[]>(convTagsKey, prev => [...(prev ?? []), tag.id]);
    }
    setNewTagName('');
    setShowAddTag(false);
  };

  const handleToggleTag = async (tagId: string) => {
    if (!selectedConversation) return;
    const tagName = tags.find(t => t.id === tagId)?.name;
    if (conversationTags.includes(tagId)) {
      await removeTagFromConversation(selectedConversation.id, tagId, tagName);
      queryClient.setQueryData<string[]>(convTagsKey, prev => (prev ?? []).filter(id => id !== tagId));
    } else {
      await addTagToConversation(selectedConversation.id, tagId, tagName);
      queryClient.setQueryData<string[]>(convTagsKey, prev => [...(prev ?? []), tagId]);
    }
  };

  const channelLabels: Record<string, string> = {
    whatsapp_uazapi: 'WhatsApp (UaZapi)',
    whatsapp_waba: 'WhatsApp (API Oficial)',
    webchat: 'WebChat',
    instagram: 'Instagram',
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendente', color: 'bg-yellow-500' },
    open: { label: 'Em atendimento', color: 'bg-emerald-500' },
    closed: { label: 'Encerrada', color: 'bg-muted-foreground' },
    resolved: { label: 'Resolvida', color: 'bg-blue-500' },
  };

  const getActionLabel = (entry: ConversationHistoryEntry): string => {
    const fn = actionLabels[entry.action];
    return fn ? fn(entry) : entry.action;
  };

  return (
    <div className="flex flex-col h-full bg-background w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">Detalhes do contato</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Contact identity (always visible) */}
      <div className="flex flex-col items-center text-center p-4 pb-3 border-b">
        <Avatar className="h-14 w-14 mb-2">
          <SmartAvatarImage src={contact.avatar} alt={contact.name} contactId={contact.id} />
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>

        {isEditingName ? (
          <div className="flex items-center gap-1 w-full max-w-[200px]">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 text-sm text-center"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveName}>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setIsEditingName(false); setEditName(contact.name); }}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => setIsEditingName(true)}>
            <h4 className="font-medium">{contact.name}</h4>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <Phone className="h-3 w-3" />
          {contact.phone}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-3 mb-0 grid w-auto grid-cols-3">
          <TabsTrigger value="geral" className="gap-1.5 text-xs">
            <Info className="h-3 w-3" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="resumos" className="gap-1.5 text-xs">
            <FileText className="h-3 w-3" />
            Resumos
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs">
            <History className="h-3 w-3" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Geral */}
        <TabsContent value="geral" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-5">
              {selectedConversation && (
                <>
                  <div className="space-y-3">
                    <h5 className="text-xs font-semibold uppercase text-muted-foreground">Conversa Atual</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Hash className="h-3 w-3" /> Protocolo
                        </span>
                        <span className="font-mono text-xs">{selectedConversation.protocol}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <MessageSquare className="h-3 w-3" /> Canal
                        </span>
                        <span className="text-xs">{channelLabels[selectedConversation.channel] || selectedConversation.channel}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Users className="h-3 w-3" /> Fila
                        </span>
                        <span className="text-xs font-medium">{queueName || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <UserCheck className="h-3 w-3" /> Atribuído
                        </span>
                        <span className={cn('text-xs', selectedConversation.assigned_to ? 'font-medium' : 'text-muted-foreground')}>
                          {selectedConversation.assigned_to || 'Não atribuído'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> SLA
                        </span>
                        {slaEvaluation ? (
                          <SlaBadge evaluation={slaEvaluation} />
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Layers className="h-3 w-3" /> Etapa da Julia
                        </span>
                        {juliaStage?.stageName ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                            style={{ backgroundColor: juliaStage.stageColor || '#3b82f6' }}
                            title={juliaStage.stageName}
                          >
                            {juliaStage.stageName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </div>
                      {(() => {
                        const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
                          low:    { label: 'Baixa',   color: 'text-muted-foreground' },
                          normal: { label: 'Normal',  color: 'text-blue-500' },
                          high:   { label: 'Alta',    color: 'text-amber-500' },
                          urgent: { label: 'Urgente', color: 'text-red-500' },
                        };
                        const p = (selectedConversation.priority as string) || 'normal';
                        const info = PRIORITY_LABELS[p] || PRIORITY_LABELS.normal;
                        return (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Tag className="h-3 w-3" /> Prioridade
                            </span>
                            <div className="flex items-center gap-1.5">
                              <PriorityBadge
                                conversationId={selectedConversation.id}
                                currentPriority={p}
                                compact
                              />
                              <span className={cn('text-xs font-medium', info.color)}>{info.label}</span>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> Aberta em
                        </span>
                        <span className="text-xs">{format(new Date(selectedConversation.opened_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                      </div>
                      {selectedConversation.first_response_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">1ª resposta</span>
                          <span className="text-xs">{format(new Date(selectedConversation.first_response_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                        </div>
                      )}
                      {selectedConversation.department && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">Setor</span>
                          <span className="text-xs">{selectedConversation.department}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Tags */}
              {selectedConversation && (
                <>
                  <TagSelector
                    allTags={tags}
                    activeTags={conversationTags}
                    onToggle={handleToggleTag}
                    onCreateAndAdd={handleAddTag}
                    newTagName={newTagName}
                    onNewTagNameChange={setNewTagName}
                    showAddTag={showAddTag}
                    onToggleAddTag={() => setShowAddTag(v => !v)}
                  />
                  <Separator />
                  <ConversationParticipants conversationId={selectedConversation.id} />
                  <Separator />
                </>
              )}

            </div>
          </ScrollArea>
        </TabsContent>

        {/* Resumos */}
        <TabsContent value="resumos" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {selectedConversation ? (
                <ConversationSummaries
                  conversationId={selectedConversation.id}
                  contactId={contact.id}
                />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Selecione uma conversa para ver os resumos
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Histórico */}
        <TabsContent value="historico" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Conversas anteriores do contato */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Conversas
                </h5>
                {pastConversations.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Nenhuma conversa registrada</span>
                ) : (
                  <div className="space-y-1.5">
                    {pastConversations.map(conv => {
                      const st = statusLabels[conv.status] || statusLabels.pending;
                      const isSelected = selectedConversation?.id === conv.id;
                      return (
                        <div key={conv.id} className={cn('flex items-start gap-2 text-xs p-2 rounded-md', isSelected ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50')}>
                          <div className={cn('h-2 w-2 rounded-full flex-shrink-0 mt-1', st.color)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-medium">{conv.protocol}</span>
                              <span className="text-muted-foreground whitespace-nowrap">
                                {format(new Date(conv.opened_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                              </span>
                            </div>
                            <span className="text-muted-foreground">{st.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Linha do tempo de eventos da conversa atual */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                  <History className="h-3 w-3" /> Eventos da conversa
                </h5>
                {conversationHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhum evento registrado nesta conversa
                  </p>
                ) : (
                  <div className="space-y-2">
                    {conversationHistory.map(entry => (
                      <div key={entry.id} className="flex gap-3 text-xs">
                        <div className="flex-shrink-0 w-[96px] text-muted-foreground text-right leading-tight whitespace-nowrap">
                          {format(new Date(entry.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-foreground">{entry.actor_name}</span>
                          {' '}
                          <span className="text-muted-foreground">{getActionLabel(entry)}</span>
                          {entry.notes && (
                            <p className="mt-0.5 italic text-muted-foreground">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
