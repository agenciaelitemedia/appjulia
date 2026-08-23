import React, { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Avatar, AvatarFallback, AvatarImage, Badge, Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn, getMessagePreview } from '../extend/ui';
import { CalendarClock, Loader2, Play, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useAuth } from '../extend/auth';
import type { MvpChatRowData } from '../api/types';

function initials(name?: string | null) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/** Exibe telefone BR legível: (11) 98765-4321 */
function formatPhoneDisplay(raw: string): string {
  const d = raw.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MvpChatRowData[];
  onSelect?: (row: MvpChatRowData) => void;
  onResumed?: () => void;
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

export function MvpSnoozedPanel({ open, onOpenChange, items, onSelect, onResumed }: Props) {
  const { user } = useAuth();
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [snoozedByMap, setSnoozedByMap] = useState<Record<string, string>>({});

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = new Date(a.snoozed_until ?? 0).getTime();
      const tb = new Date(b.snoozed_until ?? 0).getTime();
      return ta - tb;
    });
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const convIds = sorted
      .map((i) => i.conversation_id)
      .filter((id) => !(id in snoozedByMap));
    if (convIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('chat_conversation_history')
        .select('conversation_id, actor_name, created_at')
        .in('conversation_id', convIds)
        .eq('action', 'snoozed')
        .order('created_at', { ascending: false });
      if (cancelled || !data) return;
      const patch: Record<string, string> = {};
      for (const row of data as Array<{ conversation_id: string; actor_name: string | null }>) {
        if (!patch[row.conversation_id] && row.actor_name) {
          patch[row.conversation_id] = row.actor_name;
        }
      }
      if (Object.keys(patch).length > 0) setSnoozedByMap((prev) => ({ ...prev, ...patch }));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sorted, snoozedByMap]);

  const handleOpenConversation = (item: MvpChatRowData) => {
    onSelect?.(item);
    onOpenChange(false);
  };

  const handleResume = async (item: MvpChatRowData) => {
    if (resumingId) return;
    setResumingId(item.conversation_id);
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ snoozed_until: null, snooze_reason: null, snoozed_by: null })
        .eq('id', item.conversation_id);
      if (error) throw error;
      supabase
        .from('chat_conversation_history')
        .insert({
          conversation_id: item.conversation_id,
          action: 'snooze_cancelled',
          actor_name: user?.name || user?.email || 'Sistema',
          user_id: user?.id ? Number(user.id) : null,
        })
        .then();
      toast.success('Conversa retomada');
      onResumed?.();
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
            {sorted.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {sorted.length}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Conversas com retorno agendado. Clique para abrir ou retome agora.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhuma conversa adiada.
            </p>
          )}

          <TooltipProvider delayDuration={200}>
            {sorted.map((item) => {
              const byName = snoozedByMap[item.conversation_id] || null;
              const displayName = item.lead_full_name || item.contact_name || item.phone || 'Sem nome';
              const preview = item.last_message_text
                ? getMessagePreview({ text: item.last_message_text, type: 'text' })
                : 'Sem mensagens';
              return (
                <div
                  key={item.conversation_id}
                  className="group border rounded-lg p-3 hover:bg-muted/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenConversation(item)}
                    className="w-full flex items-start gap-3 text-left"
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      {item.avatar && <AvatarImage src={item.avatar} alt={displayName} />}
                      <AvatarFallback className="text-xs font-semibold">
                        {item.is_group ? <Users className="h-4 w-4" /> : initials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {displayName}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 text-amber-700 dark:text-amber-400 gap-1 flex-shrink-0"
                            >
                              <CalendarClock className="h-3 w-3" />
                              {formatRelative(new Date(item.snoozed_until!))}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Retorna em {formatAbsolute(new Date(item.snoozed_until!))}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {item.phone && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {formatPhoneDisplay(item.phone)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {preview}
                      </p>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                        <span>Retorno: {formatAbsolute(new Date(item.snoozed_until!))}</span>
                        {byName && <span>• por {byName}</span>}
                      </div>
                      {item.snooze_reason && (
                        <p className="text-[11px] text-muted-foreground italic mt-1 line-clamp-2">
                          “{item.snooze_reason}”
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
                      disabled={resumingId === item.conversation_id}
                    >
                      {resumingId === item.conversation_id ? (
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
