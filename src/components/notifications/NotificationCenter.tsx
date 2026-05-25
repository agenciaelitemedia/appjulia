import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Bell, X, ChevronDown } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface NotificationData {
  id: string;
  title: string;
  body: string | null;
  type: 'message' | 'poll' | 'question';
  poll_options: string[] | null;
  alert_level?: 'info' | 'notice' | 'alert';
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
      .select('id, title, body, type, poll_options, alert_level')
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

  // Listener para "Testar" — injeta um item local, sem persistir.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Partial<NotificationData> | undefined;
      if (!detail || !detail.title) return;
      const recipientId = `test-${crypto.randomUUID()}`;
      const notification: NotificationData = {
        id: recipientId,
        title: detail.title,
        body: detail.body ?? null,
        type: (detail.type as NotificationData['type']) ?? 'message',
        poll_options: detail.poll_options ?? null,
        alert_level: detail.alert_level ?? 'info',
      };
      setItems((prev) => [{ recipientId, notification, expanded: true }, ...prev]);
    };
    window.addEventListener('internal-notification:test', handler as EventListener);
    return () => window.removeEventListener('internal-notification:test', handler as EventListener);
  }, []);

  const markRead = useCallback(async (recipientId: string) => {
    if (recipientId.startsWith('test-')) return;
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
    if (recipientId.startsWith('test-')) {
      remove(recipientId);
      return;
    }
    await supabase
      .from('internal_notification_recipients')
      .update({ dismissed: true })
      .eq('id', recipientId);
    remove(recipientId);
  }, [remove]);

  const confirmPoll = useCallback(async (it: Item) => {
    const choice = pollChoice[it.recipientId];
    if (!choice) { toast.error('Selecione uma opção'); return; }
    if (it.recipientId.startsWith('test-')) {
      toast.success('Teste: resposta registrada');
      remove(it.recipientId);
      return;
    }
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
    if (it.recipientId.startsWith('test-')) {
      toast.success('Teste: resposta enviada');
      remove(it.recipientId);
      return;
    }
    await supabase
      .from('internal_notification_recipients')
      .update({ response_text: text, responded_at: new Date().toISOString(), read_at: new Date().toISOString() })
      .eq('id', it.recipientId);
    toast.success('Resposta enviada');
    remove(it.recipientId);
  }, [answerText, remove]);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[510px] max-w-[calc(100vw-2rem)]">
      {items.map((it) => {
        const n = it.notification;
        const level = n.alert_level ?? 'info';
        const palette =
          level === 'alert'
            ? { card: 'border-red-300 bg-red-50', label: 'text-red-700', icon: 'text-red-600', tag: 'Alerta' }
            : level === 'notice'
            ? { card: 'border-yellow-300 bg-yellow-50', label: 'text-yellow-800', icon: 'text-yellow-700', tag: 'Notificação' }
            : { card: 'border-blue-200 bg-blue-50', label: 'text-primary', icon: 'text-primary', tag: 'Nova mensagem' };
        return (
          <div key={it.recipientId} className={cn('rounded-lg border shadow-lg overflow-hidden', palette.card)}>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
              onClick={() => expand(it)}
            >
              <Bell className={cn('h-5 w-5 flex-shrink-0', palette.icon)} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-[13px] font-semibold leading-none', palette.label)}>{palette.tag}</p>
                <p className="text-base font-medium truncate mt-1">{n.title}</p>
              </div>
              {!it.expanded && <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              {it.expanded && n.type === 'message' && (
                <X className="h-5 w-5 text-muted-foreground" onClick={(e) => { e.stopPropagation(); dismiss(it.recipientId); }} />
              )}
            </button>

            {it.expanded && (
              <div className="px-4 pb-4 space-y-3">
                {n.body && (
                  <div className="text-[15px] text-foreground/80 break-words leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-strong:font-semibold prose-a:text-primary prose-blockquote:border-l-2 prose-blockquote:border-primary/40 prose-blockquote:pl-2 prose-blockquote:italic prose-code:bg-muted/60 prose-code:rounded prose-code:px-1 prose-code:text-xs prose-pre:bg-muted/60 prose-pre:rounded prose-pre:p-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.body}</ReactMarkdown>
                  </div>
                )}

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
