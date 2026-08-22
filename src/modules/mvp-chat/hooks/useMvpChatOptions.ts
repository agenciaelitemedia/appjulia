import { useEffect, useState } from 'react';
import { supabase } from '../extend/db';

export interface OptionItem { id: string; name: string; color?: string | null }

/** Filas e etiquetas do cliente — 1 request cada, só para popular os selects. */
export function useMvpChatOptions(clientId: string | null) {
  const [queues, setQueues] = useState<OptionItem[]>([]);
  const [tags, setTags] = useState<OptionItem[]>([]);

  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    (async () => {
      const [q, t] = await Promise.all([
        supabase.from('queues').select('id, name').eq('client_id', clientId).eq('is_deleted', false).order('name'),
        supabase.from('chat_tags').select('id, name, color').eq('client_id', clientId).order('name'),
      ]);
      if (!alive) return;
      setQueues(((q.data as any[]) || []).map((r) => ({ id: r.id, name: r.name })));
      setTags(((t.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, color: r.color })));
    })();
    return () => { alive = false; };
  }, [clientId]);

  return { queues, tags };
}
