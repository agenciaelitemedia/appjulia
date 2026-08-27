import { useEffect, useState } from 'react';
import { supabase } from '../extend/db';

export interface OptionItem {
  id: string;
  name: string;
  color?: string | null;
  channel_type?: string | null;
  /** Hub de conexão da fila ('uazapi' | 'waba' | ...). */
  hub?: string | null;
  /** Credenciais UaZapi — necessárias para iniciar nova conversa. */
  evo_url?: string | null;
  evo_apikey?: string | null;
  evo_instance?: string | null;
}


/**
 * Listas dos filtros: filas e etiquetas (Supabase direto) + responsáveis e
 * etapas do CRM da Júlia (edge function, que lê o cache do banco legado).
 */
export function useJuliaChatOptions(clientId: string | null) {
  const [queues, setQueues] = useState<OptionItem[]>([]);
  const [tags, setTags] = useState<OptionItem[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [juliaStages, setJuliaStages] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    (async () => {
      const [q, t, opts] = await Promise.all([
        supabase.from('queues').select('id, name, channel_type, hub, evo_url, evo_apikey, evo_instance').eq('client_id', clientId).eq('is_deleted', false).eq('is_active', true).order('name'),
        supabase.from('chat_tags').select('id, name, color').eq('client_id', clientId).order('name'),
        supabase.functions.invoke('julia-chat-list-feed', { body: { client_id: clientId, options: true } }),
      ]);
      if (!alive) return;
      setQueues(((q.data as any[]) || []).map((r) => ({
        id: r.id,
        name: r.name,
        channel_type: r.channel_type,
        hub: r.hub ?? null,
        evo_url: r.evo_url ?? null,
        evo_apikey: r.evo_apikey ?? null,
        evo_instance: r.evo_instance ?? null,
      })));

      setTags(((t.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, color: r.color })));
      const data = (opts as any)?.data ?? null;
      setOwners(Array.isArray(data?.owners) ? data.owners : []);
      setJuliaStages(Array.isArray(data?.stages) ? data.stages : []);
    })();
    return () => { alive = false; };
  }, [clientId]);

  return { queues, tags, owners, juliaStages };
}
