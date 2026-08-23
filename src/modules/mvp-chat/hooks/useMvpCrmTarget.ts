/**
 * Resolve (sob demanda) o board/deal do CRM Builder vinculado à conversa —
 * o feed retorna apenas nomes/cores, então buscamos os IDs só quando o menu
 * do badge é aberto.
 */
import { useCallback, useState } from 'react';
import { supabase } from '../extend/db';

export interface MvpCrmTarget {
  boardId: string | null;
  dealId: string | null;
}

export function useMvpCrmTarget() {
  const [loading, setLoading] = useState(false);

  const resolve = useCallback(async (args: {
    clientId: string | null;
    conversationId: string;
    contactId: string;
  }): Promise<MvpCrmTarget | null> => {
    setLoading(true);
    try {
      let q = supabase
        .from('crm_deals')
        .select('id, board_id, custom_fields, updated_at')
        .neq('status', 'archived')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (args.clientId) q = q.eq('client_id', args.clientId);
      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as Array<{
        id: string;
        board_id: string | null;
        custom_fields?: Record<string, any> | null;
      }>;

      const linkOf = (r: (typeof rows)[number]) => r.custom_fields?.links?.chat ?? {};
      const byConv = rows.find((r) => linkOf(r).conversation_id === args.conversationId);
      const byContact = rows.find((r) => linkOf(r).contact_id === args.contactId);
      const hit = byConv || byContact;
      if (!hit) return null;
      return { boardId: hit.board_id ?? null, dealId: hit.id };
    } finally {
      setLoading(false);
    }
  }, []);

  return { resolve, loading };
}
