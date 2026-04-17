import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CsatConfig {
  id: string;
  client_id: string;
  cod_agent: string | null;
  is_active: boolean;
  auto_send_after_resolve: boolean;
  delay_minutes: number;
  survey_type: string;
  message_template: string;
  thank_you_message: string;
}

export function useCsatConfig(clientId: string | null) {
  return useQuery({
    queryKey: ['csat-config', clientId],
    queryFn: async (): Promise<CsatConfig | null> => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('chat_csat_config')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

export function useSaveCsatConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: Partial<CsatConfig> & { client_id: string }) => {
      if (config.id) {
        const { data, error } = await supabase
          .from('chat_csat_config')
          .update(config)
          .eq('id', config.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('chat_csat_config').insert(config).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csat-config'] });
      toast.success('Configuração CSAT salva');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface CsatStats {
  total: number;
  responded: number;
  averageScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  byAgent: Array<{ cod_agent: string; total: number; avg: number }>;
}

export function useCsatStats(clientId: string | null, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['csat-stats', clientId, dateFrom, dateTo],
    queryFn: async (): Promise<CsatStats> => {
      if (!clientId) return { total: 0, responded: 0, averageScore: 0, promoters: 0, passives: 0, detractors: 0, byAgent: [] };
      let q = supabase.from('chat_csat_responses').select('*').eq('client_id', clientId);
      if (dateFrom) q = q.gte('sent_at', dateFrom);
      if (dateTo) q = q.lte('sent_at', dateTo);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];
      const responded = rows.filter(r => r.status === 'responded' || r.responded_at);
      const total = rows.length;
      const avg = responded.length ? responded.reduce((s, r) => s + (r.score || 0), 0) / responded.length : 0;
      const promoters = responded.filter(r => r.score >= 4).length;
      const passives = responded.filter(r => r.score === 3).length;
      const detractors = responded.filter(r => r.score <= 2).length;
      const agentMap = new Map<string, { total: number; sum: number }>();
      responded.forEach(r => {
        const k = r.cod_agent || '—';
        const cur = agentMap.get(k) || { total: 0, sum: 0 };
        cur.total++;
        cur.sum += r.score || 0;
        agentMap.set(k, cur);
      });
      const byAgent = Array.from(agentMap.entries())
        .map(([cod_agent, v]) => ({ cod_agent, total: v.total, avg: v.sum / v.total }))
        .sort((a, b) => b.total - a.total);
      return { total, responded: responded.length, averageScore: avg, promoters, passives, detractors, byAgent };
    },
    enabled: !!clientId,
  });
}
