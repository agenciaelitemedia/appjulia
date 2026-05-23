import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Bell, X, ChevronDown } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface NotificationData {
  id: string;
  title: string;
  body: string | null;
  type: 'message' | 'poll' | 'question';
  poll_options: string[] | null;
}

interface Item {
  recipientId: string;
  notification: NotificationData;
  expanded: boolean;
}

export function NotificationCenter() {
  const { user } = useAuth();
  const userId = user?.id != null ? String(user.id) : null;

  const [items, setItems] = useState<Item[]>([]);
  const [pollChoice, setPollChoice] = useState<Record<string, string>>({});
  const [answerText, setAnswerText] = useState<Record<string, string>>({});
  const seen = useRef<Set<string>>(new Set());

  const addRecipient = useCallback(async (recipientId: string, notificationId: string) => {
    if (seen.current.has(recipientId)) return;
    const { data: n } = await supabase
      .from('internal_notifications')
      .select('id, title, body, type, poll_options')
      .eq('id', notificationId)
      .maybeSingle();
    if (!n) return;
    seen.current.add(recipientId);
    setItems((prev) => [
      { recipientId, notification: n as unknown as NotificationData, expanded: false },
      ...prev,
    ]);
  }, []);

  // Load pending (unread, not dismissed) on mount + subscribe to realtime inserts.
  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      const { data } = await supabase
        .from('internal_notification_recipients')
        .select('id, notification_id')
        .eq('user_id', userId)
        .is('read_at', null)
        .eq('dismissed', false)
        .order('created_at', { ascending: true })
        .limit(20);
      if (!active) return;
      for (const r of data || []) await addRecipient(r.id, r.notification_id);
    })();

    const channel = supabase
      .channel(`inotif-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'internal_notification_recipients', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { id: string; notification_id: string };
          addRecipient(row.id, row.notification_id);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, addRecipient]);

  const markRead = useCallback(async (recipientId: string) => {
    await supabase
      .from('internal_notification_recipients')
      .update({ read_at: new Date().toISOString() })
      .eq('id', recipientId)
      .is('read_at', null);
  }, []);

  const expand = useCallback((it: Item) => {
    setItems((prev) => prev.map((p) => (p.recipientId === it.recipientId ? { ...p, expanded: true } : p)));
    if (!it.expanded) markRead(it.recipientId); // "lido" = expandiu
  }, [markRead]);

  const remove = useCallback((recipientId: string) => {
    setItems((prev) => prev.filter((p) => p.recipientId !== recipientId));
  }, []);

  const dismiss = useCallback(async (recipientId: string) => {
    await supabase
      .from('internal_notification_recipients')
      .update({ dismissed: true })
      .eq('id', recipientId);
    remove(recipientId);
  }, [remove]);

  const confirmPoll = useCallback(async (it: Item) => {
    const choice = pollChoice[it.recipientId];
    if (!choice) { toast.error('Selecione uma opção'); return; }
    await supabase
      .from('internal_notification_recipients')
      .update({ poll_choice: choice, responded_at: new Date().toISOString(), read_at: new Date().toISOString() })
      .eq('id', it.recipientId);
    toast.success('Resposta registrada');
    remove(it.recipientId);
  }, [pollChoice, remove]);

  const confirmAnswer = useCallback(async (it: Item) => {
    const text = (answerText[it.recipientId] ?? '').trim();
    if (!text) { toast.error('Digite uma resposta'); return; }
    await supabase
      .from('internal_notification_recipients')
      .update({ response_text: text, responded_at: new Date().toISOString(), read_at: new Date().toISOString() })
      .eq('id', it.recipientId);
    toast.success('Resposta enviada');
    remove(it.recipientId);
  }, [answerText, remove]);

  if (!userId || items.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)]">
      {items.map((it) => {
        const n = it.notification;
        return (
          <div key={it.recipientId} className="rounded-lg border border-blue-200 bg-blue-50 shadow-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50"
              onClick={() => expand(it)}
            >
              <Bell className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-primary leading-none">Nova mensagem</p>
                <p className="text-sm font-medium truncate">{n.title}</p>
              </div>
              {!it.expanded && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              {it.expanded && n.type === 'message' && (
                <X className="h-4 w-4 text-muted-foreground" onClick={(e) => { e.stopPropagation(); dismiss(it.recipientId); }} />
              )}
            </button>

            {it.expanded && (
              <div className="px-3 pb-3 space-y-3">
                {n.body && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>}

                {n.type === 'message' && (
                  <Button size="sm" className="w-full" onClick={() => dismiss(it.recipientId)}>Lido</Button>
                )}

                {n.type === 'poll' && (
                  <div className="space-y-2">
                    {(n.poll_options || []).map((opt, idx) => {
                      const selected = pollChoice[it.recipientId] === opt;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPollChoice((p) => ({ ...p, [it.recipientId]: opt }))}
                          className={cn(
                            'w-full text-left text-sm rounded-md border px-3 py-2',
                            selected ? 'border-primary bg-primary/10' : 'hover:bg-muted/50',
                          )}
                        >
                          {opt}
                        </button>
                      );
                    })}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => dismiss(it.recipientId)}>Fechar</Button>
                      <Button size="sm" className="flex-1" onClick={() => confirmPoll(it)}>Confirmar</Button>
                    </div>
                  </div>
                )}

                {n.type === 'question' && (
                  <div className="space-y-2">
                    <Textarea
                      value={answerText[it.recipientId] ?? ''}
                      onChange={(e) => setAnswerText((p) => ({ ...p, [it.recipientId]: e.target.value }))}
                      placeholder="Sua resposta…"
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => dismiss(it.recipientId)}>Fechar</Button>
                      <Button size="sm" className="flex-1" onClick={() => confirmAnswer(it)}>Confirmar</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
