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
    case '3m':
      return { from: new Date(startOfDay.getTime() - 89 * 864e5).toISOString(), to: null };
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: null };
    default:
      return { from: null, to: null };
  }
}

/**
 * ÚNICA chamada de dados do MVP: a edge function devolve o card completo
 * (badges de CRM da Júlia, CRM Builder, ticket, Meta Ads, sessão, SLA) já
 * filtrado, ordenado e paginado no servidor. Os dados do banco legado passam
 * por cache server-side com invalidação por janela de tempo.
 */
export async function fetchMvpChatFeed(params: {
  clientId: string;
  filters: MvpChatFilters;
  limit: number;
  offset: number;
  refresh?: boolean;
}): Promise<MvpChatFeedResponse> {
  const { from, to } = periodToRange(params.filters.period);
  const f = params.filters;

  const scopeQueues = f.scope_queue_ids ?? [];
  const queueIds = f.queue_ids.length ? f.queue_ids : (scopeQueues.length ? scopeQueues : null);

  const { data, error } = await supabase.functions.invoke('mvp-chat-list-feed', {
    body: {
      client_id: params.clientId,
      queue_ids: queueIds,
      status: f.status,
      tab: f.tab,

      owners: f.owners.length ? f.owners : null,
      unassigned: f.unassigned,
      search: f.search?.trim() || null,
      from,
      to,
      tag_ids: f.tag_ids.length ? f.tag_ids : null,
      priority: f.priority,
      has_ticket: f.has_ticket,
      has_crm_builder: f.has_crm_builder,
      sla_status: f.sla_status.length ? f.sla_status : null,
      julia_stage_ids: f.julia_stage_ids.length ? f.julia_stage_ids : null,
      julia_mode: f.julia_mode,
      has_campaign: f.has_campaign,
      sort: f.sort,
      hide_snoozed: f.hide_snoozed ?? true,
      restrict_open_to: f.restrict_open_to?.length ? f.restrict_open_to : null,
      limit: params.limit,
      offset: params.offset,
      refresh: params.refresh ?? false,

    },
  });

  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as MvpChatFeedResponse;
}
