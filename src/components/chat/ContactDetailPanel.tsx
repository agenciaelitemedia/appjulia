import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Phone, MessageSquare, Clock, Tag, History, Plus, Hash, Check, Pencil, Info, FileText } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConversationParticipants } from './ConversationParticipants';
import { ConversationSummaries } from './ConversationSummaries';
import type { ChatContact } from '@/types/chat';
import type { ChatConversation, ConversationHistoryEntry } from '@/types/conversation';

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
  priority_changed: (e) => `alterou prioridade para ${e.to_value}`,
  queue_changed:    (e) => `transferiu para fila ${e.to_value}`,
  transferred:      (e) => `transferiu para ${e.to_value}`,
  status_changed:   (e) => `alterou status para ${e.to_value}`,
  snoozed:          (e) => `adiou a conversa até ${e.to_value}`,
  tag_added:        (e) => `adicionou tag ${e.to_value}`,
  tag_removed:      (e) => `removeu tag ${e.to_value}`,
};

export function ContactDetailPanel({ contact, onClose }: ContactDetailPanelProps) {
  const {
    selectedConversation, tags, createTag, addTagToConversation, removeTagFromConversation,
    conversationHistory, loadConversationHistory,
  } = useWhatsAppData();
  const [pastConversations, setPastConversations] = useState<ChatConversation[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [conversationTags, setConversationTags] = useState<string[]>([]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(contact.name);

  const initials = contact.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  useEffect(() => {
    async function loadPast() {
      const { data } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setPastConversations((data || []) as ChatConversation[]);
    }
    loadPast();
  }, [contact.id]);

  useEffect(() => {
    async function loadConvTags() {
      if (!selectedConversation) return;
      const { data } = await supabase
        .from('chat_conversation_tags')
        .select('tag_id')
        .eq('conversation_id', selectedConversation.id);
      setConversationTags((data || []).map((t: any) => t.tag_id));
    }
    loadConvTags();
  }, [selectedConversation?.id]);

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

  const handleAddTag = async () => {
    if (!newTagName.trim() || !selectedConversation) return;
    const tag = await createTag(newTagName.trim(), '#3b82f6');
    if (tag) {
      await addTagToConversation(selectedConversation.id, tag.id);
      setConversationTags(prev => [...prev, tag.id]);
    }
    setNewTagName('');
    setShowAddTag(false);
  };

  const handleToggleTag = async (tagId: string) => {
    if (!selectedConversation) return;
    if (conversationTags.includes(tagId)) {
      await removeTagFromConversation(selectedConversation.id, tagId);
      setConversationTags(prev => prev.filter(id => id !== tagId));
    } else {
      await addTagToConversation(selectedConversation.id, tagId);
      setConversationTags(prev => [...prev, tagId]);
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
          <AvatarImage src={contact.avatar} alt={contact.name} />
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
                      {selectedConversation.assigned_to && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">Atribuído a</span>
                          <span className="text-xs font-medium">{selectedConversation.assigned_to}</span>
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
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                        <Tag className="h-3 w-3" /> Tags
                      </h5>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddTag(!showAddTag)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {showAddTag && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nova tag..."
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          className="h-7 text-xs"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                        />
                        <Button size="sm" className="h-7 text-xs" onClick={handleAddTag}>
                          Criar
                        </Button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {tags.map(tag => (
                        <Badge
                          key={tag.id}
                          variant={conversationTags.includes(tag.id) ? 'default' : 'outline'}
                          className="cursor-pointer text-[10px] px-2 py-0.5"
                          style={conversationTags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                          onClick={() => handleToggleTag(tag.id)}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                      {tags.length === 0 && !showAddTag && (
                        <span className="text-xs text-muted-foreground">Nenhuma tag criada</span>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <ConversationParticipants conversationId={selectedConversation.id} />
                  <Separator />
                </>
              )}

              {/* Past Conversations */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                  <History className="h-3 w-3" /> Histórico de Conversas
                </h5>
                {pastConversations.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Nenhuma conversa anterior</span>
                ) : (
                  <div className="space-y-2">
                    {pastConversations.map(conv => {
                      const st = statusLabels[conv.status] || statusLabels.pending;
                      return (
                        <div key={conv.id} className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50">
                          <div className={cn('h-2 w-2 rounded-full flex-shrink-0', st.color)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-mono">{conv.protocol}</span>
                              <span className="text-muted-foreground">
                                {format(new Date(conv.opened_at), 'dd/MM/yy', { locale: ptBR })}
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
            <div className="p-4 space-y-2">
              {conversationHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Nenhum evento registrado nesta conversa
                </p>
              ) : (
                conversationHistory.map(entry => (
                  <div key={entry.id} className="flex gap-3 text-xs">
                    <div className="flex-shrink-0 w-[72px] text-muted-foreground text-right">
                      {format(new Date(entry.created_at), 'dd/MM HH:mm', { locale: ptBR })}
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
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
