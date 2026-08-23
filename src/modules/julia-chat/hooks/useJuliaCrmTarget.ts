/**
 * Resolve (sob demanda) o board/deal do CRM Builder vinculado à conversa —
 * o feed retorna apenas nomes/cores, então buscamos os IDs só quando o menu
 * do badge é aberto.
 */
import { useCallback, useState } from 'react';
import { supabase } from '../extend/db';

export interface JuliaCrmTarget {
  boardId: string | null;
  dealId: string | null;
}

export function useJuliaCrmTarget() {
  const [loading, setLoading] = useState(false);

  const resolve = useCallback(async (args: {
    clientId: string | null;
    conversationId: string;
    contactId: string;
  }): Promise<JuliaCrmTarget | null> => {
    setLoading(true);
    try {
      const base = () => {
        let q = supabase
          .from('crm_deals')
          .select('id, board_id, updated_at')
          .neq('status', 'archived')
          .order('updated_at', { ascending: false })
          .limit(1);
        if (args.clientId) q = q.eq('client_id', args.clientId);
        return q;
      };

      // 1) vínculo pela conversa
      const byConv = await base().eq('custom_fields->links->chat->>conversation_id', args.conversationId);
      if (byConv.error) throw byConv.error;
      let hit = byConv.data?.[0] as { id: string; board_id: string | null } | undefined;

      // 2) fallback: vínculo pelo contato
      if (!hit) {
        const byContact = await base().eq('custom_fields->links->chat->>contact_id', args.contactId);
        if (byContact.error) throw byContact.error;
        hit = byContact.data?.[0] as { id: string; board_id: string | null } | undefined;
      }

      if (!hit) return null;
      return { boardId: hit.board_id ?? null, dealId: hit.id };
    } finally {
      setLoading(false);
    }
  }, []);

  return { resolve, loading };
}
