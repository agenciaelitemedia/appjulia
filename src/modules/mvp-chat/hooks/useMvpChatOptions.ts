import { useEffect, useState } from 'react';
import { supabase } from '../extend/db';

export interface OptionItem { id: string; name: string; color?: string | null }

/**
 * Listas dos filtros: filas e etiquetas (Supabase direto) + responsáveis e
 * etapas do CRM da Júlia (edge function, que lê o cache do banco legado).
 */
export function useMvpChatOptions(clientId: string | null) {
  const [queues, setQueues] = useState<OptionItem[]>([]);
  const [tags, setTags] = useState<OptionItem[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [juliaStages, setJuliaStages] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    (async () => {
      const [q, t, opts] = await Promise.all([
        supabase.from('queues').select('id, name').eq('client_id', clientId).eq('is_deleted', false).order('name'),
        supabase.from('chat_tags').select('id, name, color').eq('client_id', clientId).order('name'),
        supabase.functions.invoke('mvp-chat-list-feed', { body: { client_id: clientId, options: true } }),
      ]);
      if (!alive) return;
      setQueues(((q.data as any[]) || []).map((r) => ({ id: r.id, name: r.name })));
      setTags(((t.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, color: r.color })));
      const data = (opts as any)?.data ?? null;
      setOwners(Array.isArray(data?.owners) ? data.owners : []);
      setJuliaStages(Array.isArray(data?.stages) ? data.stages : []);
    })();
    return () => { alive = false; };
  }, [clientId]);

  return { queues, tags, owners, juliaStages };
}
