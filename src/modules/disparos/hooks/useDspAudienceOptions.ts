import { useQuery } from '@tanstack/react-query';
import { supabase, externalDb } from '../extend/db';

export interface Option {
  id: string;
  name: string;
  extra?: string | null;
}

/** Tags de conversa do tenant. */
export function useDspTags(clientId: string | null) {
  return useQuery<Option[]>({
    queryKey: ['disparos', 'opt-tags', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('chat_tags')
        .select('id, name')
        .eq('client_id', String(clientId))
        .order('name');
      if (error) throw error;
      return (data ?? []) as Option[];
    },
  });
}

/** Painéis do CRM Builder. */
export function useDspBoards(clientId: string | null) {
  return useQuery<Option[]>({
    queryKey: ['disparos', 'opt-boards', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_boards')
        .select('id, name')
        .eq('client_id', String(clientId))
        .eq('is_archived', false)
        .order('position');
      if (error) throw error;
      return (data ?? []) as Option[];
    },
  });
}

/** Etapas (pipelines) do CRM Builder, opcionalmente filtradas por painel. */
export function useDspPipelines(clientId: string | null, boardIds: string[]) {
  return useQuery<(Option & { board_id: string })[]>({
    queryKey: ['disparos', 'opt-pipelines', clientId, boardIds.join(',')],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from('crm_pipelines')
        .select('id, name, board_id')
        .eq('client_id', String(clientId))
        .eq('is_active', true)
        .order('position');
      if (boardIds.length) q = q.in('board_id', boardIds);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as (Option & { board_id: string })[];
    },
  });
}

/** Campanhas anteriores de disparo. */
export function useDspCampaignOptions(clientId: string | null) {
  return useQuery<Option[]>({
    queryKey: ['disparos', 'opt-campaigns', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dsp_campaigns')
        .select('id, name, status')
        .eq('client_id', String(clientId))
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, extra: r.status }));
    },
  });
}

/** Códigos de agente (cod_agent) presentes nos contatos do tenant. */
export function useDspAgentCodes(clientId: string | null) {
  return useQuery<Option[]>({
    queryKey: ['disparos', 'opt-agents', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('chat_contacts')
        .select('cod_agent')
        .eq('client_id', String(clientId))
        .not('cod_agent', 'is', null)
        .limit(5000);
      if (error) throw error;
      const codes = [...new Set((data ?? []).map((r: any) => String(r.cod_agent)))]
        .filter(Boolean)
        .sort() as string[];
      return codes.map((c) => ({ id: c, name: `Agente ${c}` }));
    },
  });
}

/** Etapas do CRM da Julia (banco legado). */
export function useDspJuliaStages() {
  return useQuery<Option[]>({
    queryKey: ['disparos', 'opt-julia-stages'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows = (await externalDb.raw<{ id: string; name: string }>({
        query: `SELECT s.id::text AS id, s.name
                  FROM crm_atendimento_stages s
                 WHERE s.is_active IS NOT FALSE
                 ORDER BY s.position NULLS LAST, s.name`,
        params: [],
      })) as Option[];
      return rows ?? [];
    },
  });
}
