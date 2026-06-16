import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { resolveEffectiveClientId } from '@/lib/resolveEffectiveClientId';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

export interface RoutingCondition {
  field: 'channel' | 'tag' | 'priority' | 'keyword' | 'business_hours' | 'queue' | 'contact_is_new';
  op: 'equals' | 'contains' | 'in' | 'not_in';
  value: string;
}

export interface RoutingRule {
  id: string;
  client_id: string;
  cod_agent: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  position: number;
  conditions: RoutingCondition[];
  strategy: 'round_robin' | 'least_busy' | 'specific_agent' | 'manual_pool' | 'random';
  agent_pool: string[];
  excluded_agents: string[];
  online_only: boolean;
  target_queue_id: string | null;
  fallback_assigned_to: string | null;
  only_business_hours: boolean;
  execution_count: number;
  last_executed_at: string | null;
  last_assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentCapacity {
  id: string;
  client_id: string;
  agent_identifier: string;
  agent_name: string | null;
  max_concurrent: number;
  status: 'online' | 'away' | 'busy' | 'offline';
  is_active: boolean;
  current_load: number;
  last_assigned_at: string | null;
}

/**
 * Resolve o client_id efetivo do escritório (owner) ao qual o usuário
 * logado pertence. Sempre retorna string — fallback 'default' apenas
 * para não quebrar query enquanto carrega.
 */
function useEffectiveClientId() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    void resolveEffectiveClientId(user, 'useChatRouting').then((cid) => {
      if (mounted) setClientId(cid || null);
    });
    return () => { mounted = false; };
  }, [user?.id, user?.client_id]);
  return clientId;
}

export function useChatRouting() {
  const qc = useQueryClient();
  const clientId = useEffectiveClientId();
  const cid = clientId || '';

  const rules = useQuery({
    queryKey: ['chat-routing-rules', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_routing_rules')
        .select('*')
        .eq('client_id', cid)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as RoutingRule[];
    },
  });

  const capacities = useQuery({
    queryKey: ['chat-agent-capacity', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_agent_capacity')
        .select('*')
        .eq('client_id', cid)
        .order('agent_name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as AgentCapacity[];
    },
  });

  const upsertRule = useMutation({
    mutationFn: async (rule: Partial<RoutingRule>) => {
      if (!rule.name) throw new Error('Nome é obrigatório');
      if (!cid) throw new Error('Client ID indisponível');
      const payload = { ...rule, client_id: cid };
      const { error } = rule.id
        ? await supabase.from('chat_routing_rules').update(payload as never).eq('id', rule.id)
        : await supabase.from('chat_routing_rules').insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-routing-rules', cid] });
      toast.success('Regra salva');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_routing_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-routing-rules', cid] }),
  });

  const upsertCapacity = useMutation({
    mutationFn: async (cap: Partial<AgentCapacity>) => {
      if (!cap.agent_identifier) throw new Error('Identificador é obrigatório');
      if (!cid) throw new Error('Client ID indisponível');
      const payload = { ...cap, client_id: cid };
      const { error } = await supabase
        .from('chat_agent_capacity')
        .upsert(payload as never, { onConflict: 'client_id,agent_identifier' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-agent-capacity', cid] });
      toast.success('Capacidade atualizada');
    },
  });

  const removeCapacity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_agent_capacity').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-agent-capacity', cid] }),
  });

  return { rules, capacities, upsertRule, removeRule, upsertCapacity, removeCapacity, clientId: cid };
}
