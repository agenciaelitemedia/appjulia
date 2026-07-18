import React, { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarClock, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SnoozedItem {
  conversationId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  avatar?: string | null;
  preview: string;
  snoozedUntil: Date;
  snoozedBy?: string | null;
  snoozeReason?: string | null;
  queueId?: string | null;
}

function formatRelative(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return 'a qualquer momento';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `em ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `em ${hr}h${min % 60 ? ` ${min % 60}m` : ''}`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `em ${day}d${hr % 24 ? ` ${hr % 24}h` : ''}`;
  const wk = Math.floor(day / 7);
  return `em ${wk} sem`;
}

function formatAbsolute(target: Date): string {
  return target.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function SnoozedConversationsPanel({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { conversations, contacts, selectContact, setSelectedQueue, selectedQueue } = useWhatsAppData();
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [snoozedByMap, setSnoozedByMap] = useState<Record<string, string>>({});

  // Deriva a lista de conversas adiadas ativas do estado do contexto.
  const items = useMemo<SnoozedItem[]>(() => {
    const now = Date.now();
    const contactById = new Map(contacts.map((c) => [c.id, c] as const));
    const seen = new Set<string>();
    const result: SnoozedItem[] = [];
    for (const conv of conversations) {
      const su = (conv as { snoozed_until?: string | null }).snoozed_until;
      if (!su) continue;
      const dt = new Date(su);
      if (!(dt.getTime() > now)) continue;
      // Um item por contato — o líder (conversations já vem ordenado por updated_at desc)
      if (seen.has(conv.contact_id)) continue;
      seen.add(conv.contact_id);
      const contact = contactById.get(conv.contact_id);
      result.push({
        conversationId: conv.id,
        contactId: conv.contact_id,
        contactName: contact?.name || contact?.phone || 'Sem nome',
        contactPhone: contact?.phone || '',
        avatar: contact?.avatar,
        preview: contact?.last_message_text || '',
        snoozedUntil: dt,
        snoozeReason: (conv as { snooze_reason?: string | null }).snooze_reason || null,
        snoozedBy: (conv as { snoozed_by?: string | null }).snoozed_by || null,
        queueId: conv.queue_id ?? null,
      });
    }
    result.sort((a, b) => a.snoozedUntil.getTime() - b.snoozedUntil.getTime());
    return result;
  }, [conversations, contacts]);

  // Resolve nomes de quem adiou (snoozed_by contém user.id como string).
  useEffect(() => {
    if (!open) return;
    const ids = Array.from(
      new Set(
        items
          .map((i) => i.snoozedBy)
          .filter((v): v is string => !!v && /^\d+$/.test(v) && !snoozedByMap[v]),
      ),
    );
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('agents')
        .select('id, whatsapp_profile_name')
        .in('id', ids.map((v) => Number(v)));
      if (cancelled || !data) return;
      const patch: Record<string, string> = {};
      for (const row of data as Array<{ id: number; whatsapp_profile_name?: string | null }>) {
        if (row.whatsapp_profile_name) patch[String(row.id)] = row.whatsapp_profile_name;
      }
      if (Object.keys(patch).length > 0) setSnoozedByMap((prev) => ({ ...prev, ...patch }));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, items, snoozedByMap]);

  const handleOpenConversation = async (item: SnoozedItem) => {
    // Garante fila correta antes de selecionar o contato
    if (item.queueId && selectedQueue?.id !== item.queueId) {
      const { data } = await supabase
        .from('queues')
        .select('id, name, channel_type, hub, evo_url, evo_apikey, evo_instance, is_deleted')
        .eq('id', item.queueId)
        .maybeSingle();
      if (data && (data as { is_deleted?: boolean }).is_deleted !== true) {
        setSelectedQueue({
          id: (data as { id: string }).id,
          name: (data as { name?: string }).name ?? '',
          channel_type: ((data as { channel_type?: string }).channel_type) ?? '',
          hub: ((data as { hub?: string | null }).hub) ?? null,
          evo_url: ((data as { evo_url?: string | null }).evo_url) ?? null,
          evo_apikey: ((data as { evo_apikey?: string | null }).evo_apikey) ?? null,
          evo_instance: ((data as { evo_instance?: string | null }).evo_instance) ?? null,
        });
      }
    }
    selectContact(item.contactId);
    onOpenChange(false);
  };

  const handleResume = async (item: SnoozedItem) => {
    if (resumingId) return;
    setResumingId(item.conversationId);
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ snoozed_until: null, snooze_reason: null, snoozed_by: null })
        .eq('id', item.conversationId);
      if (error) throw error;
      supabase
        .from('chat_conversation_history')
        .insert({
          conversation_id: item.conversationId,
          action: 'snooze_cancelled',
          actor_name: user?.name || user?.email || 'Sistema',
          user_id: user?.id ? Number(user.id) : null,
        })
        .then();
      toast.success('Conversa retomada');
    } catch (e) {
      toast.error('Erro ao retomar', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setResumingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Conversas adiadas
            {items.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {items.length}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Conversas com retorno agendado. Clique para abrir ou retome agora.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhuma conversa adiada.
            </p>
          )}

          <TooltipProvider delayDuration={200}>
            {items.map((item) => {
              const byName =
                item.snoozedBy && snoozedByMap[item.snoozedBy]
                  ? snoozedByMap[item.snoozedBy]
                  : null;
              return (
                <div
                  key={item.conversationId}
                  className="group border rounded-lg p-3 hover:bg-muted/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenConversation(item)}
                    className="w-full flex items-start gap-3 text-left"
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      {item.avatar && <AvatarImage src={item.avatar} alt={item.contactName} />}
                      <AvatarFallback>
                        {item.contactName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {item.contactName}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 text-amber-700 dark:text-amber-400 gap-1 flex-shrink-0"
                            >
                              <CalendarClock className="h-3 w-3" />
                              {formatRelative(item.snoozedUntil)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Retorna em {formatAbsolute(item.snoozedUntil)}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {item.preview && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.preview}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                        <span>Retorno: {formatAbsolute(item.snoozedUntil)}</span>
                        {byName && <span>• por {byName}</span>}
                      </div>
                      {item.snoozeReason && (
                        <p className="text-[11px] text-muted-foreground italic mt-1 line-clamp-2">
                          “{item.snoozeReason}”
                        </p>
                      )}
                    </div>
                  </button>
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => handleResume(item)}
                      disabled={resumingId === item.conversationId}
                    >
                      {resumingId === item.conversationId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Play className="h-3.5 w-3.5 mr-1" />
                      )}
                      Retomar agora
                    </Button>
                  </div>
                </div>
              );
            })}
          </TooltipProvider>
        </div>
      </SheetContent>
    </Sheet>
  );
}
