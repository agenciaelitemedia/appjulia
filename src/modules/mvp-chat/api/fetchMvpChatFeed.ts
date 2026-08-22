import { supabase } from '../extend/db';
import type { MvpChatFeedResponse, MvpChatFilters } from './types';

function periodToRange(period: MvpChatFilters['period']): { from: string | null; to: string | null } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case 'today':
      return { from: startOfDay.toISOString(), to: null };
    case '7d':
      return { from: new Date(startOfDay.getTime() - 6 * 864e5).toISOString(), to: null };
    case '30d':
      return { from: new Date(startOfDay.getTime() - 29 * 864e5).toISOString(), to: null };
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: null };
    default:
      return { from: null, to: null };
  }
}

/**
 * ÚNICA chamada de dados do MVP: a edge function devolve o card completo
 * (badges de CRM da Júlia, CRM Builder, ticket, Meta Ads, sessão) já filtrado,
 * ordenado e paginado no servidor.
 */
export async function fetchMvpChatFeed(params: {
  clientId: string;
  filters: MvpChatFilters;
  limit: number;
  offset: number;
}): Promise<MvpChatFeedResponse> {
  const { from, to } = periodToRange(params.filters.period);
  const f = params.filters;

  const { data, error } = await supabase.functions.invoke('mvp-chat-list-feed', {
    body: {
      client_id: params.clientId,
      queue_ids: f.queue_ids.length ? f.queue_ids : null,
      status: f.status,
      tab: f.tab,
      owner: f.owner,
      unassigned: f.unassigned,
      search: f.search?.trim() || null,
      from,
      to,
      tag_ids: f.tag_ids.length ? f.tag_ids : null,
      priority: f.priority,
      has_ticket: f.has_ticket,
      has_crm_builder: f.has_crm_builder,
      julia_stage: f.julia_stage,
      julia_mode: f.julia_mode,
      has_campaign: f.has_campaign,
      sort: f.sort,
      limit: params.limit,
      offset: params.offset,
    },
  });

  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as MvpChatFeedResponse;
}
