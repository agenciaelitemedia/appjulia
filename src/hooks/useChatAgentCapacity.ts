/**
 * Carga real (chat_agent_live_load) + teto (chat_agent_capacity) por atendente.
 *
 * REGRA: só existe limite quando a distribuição automática do escritório está
 * habilitada E o atendente tem registro ATIVO em chat_agent_capacity com
 * max_concurrent > 0. Quem não foi configurado NÃO entra no mapa (sem limite).
 * Chave do mapa = identificador canônico do atendente (user_id em string).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLiveLoadsDetailed } from '@/lib/chat/capacity';

export interface AgentCapacityRow {
  load: number;
  /** Conversas atribuídas em filas que o atendente não enxerga (não contam). */
  outOfScope: number;
  max_concurrent: number;
  is_active: boolean;
  full: boolean;
}


export function useChatAgentCapacity(enabled = true) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery<Record<string, AgentCapacityRow>>({
    queryKey: ['chat-agent-capacity-load', clientId],
    enabled: enabled && !!clientId,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [loads, capsRes, settingsRes] = await Promise.all([
        fetchLiveLoadsDetailed(clientId),

        supabase
          .from('chat_agent_capacity')
          .select('agent_identifier, max_concurrent, is_active')
          .eq('client_id', clientId),
        supabase
          .from('chat_client_settings')
          .select('settings')
          .eq('client_id', clientId)
          .maybeSingle(),
      ]);
      if (capsRes.error) throw capsRes.error;

      const settings = (settingsRes.data?.settings ?? {}) as Record<string, unknown>;
      const autoOn =
        settings.auto_distribution_enabled === true ||
        settings.auto_distribution_enabled === 'true';
      // Distribuição automática desligada => nenhum limite em vigor.
      if (!autoOn) return {};

      const out: Record<string, AgentCapacityRow> = {};
      for (const c of (capsRes.data ?? []) as Array<{
        agent_identifier: string;
        max_concurrent: number | null;
        is_active: boolean | null;
      }>) {
        const active = c.is_active !== false;
        const max = Number(c.max_concurrent) || 0;
        // Sem registro ativo com teto definido => atendente sem limite.
        if (!active || max <= 0) continue;
        const id = String(c.agent_identifier);
        const load = loads[id] ?? 0;
        out[id] = { load, max_concurrent: max, is_active: true, full: load >= max };
      }
      return out;
    },
  });
}
