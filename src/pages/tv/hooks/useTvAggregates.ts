import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AttendanceKpis {
  tme_seconds: number | null;        // tempo médio 1ª resposta
  tma_seconds: number | null;        // tempo médio atendimento (resolução)
  sla_pct: number;                   // % no prazo (não breached)
  total_24h: number;
  pending: number;
  open: number;
  resolved_today: number;
}

export function useAttendanceKpis() {
  return useQuery<AttendanceKpis>({
    queryKey: ['tv-attendance-kpis'],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayIso = startOfToday.toISOString();

      const { data, error } = await supabase
        .from('chat_conversations')
        .select('id, status, opened_at, first_response_at, resolved_at, closed_at, created_at')
        .gte('created_at', since24h);

      if (error || !data) {
        return { tme_seconds: null, tma_seconds: null, sla_pct: 0, total_24h: 0, pending: 0, open: 0, resolved_today: 0 };
      }

      let tmeSum = 0, tmeCount = 0;
      let tmaSum = 0, tmaCount = 0;
      let pending = 0, open = 0, resolvedToday = 0;
      const breachedThreshold = 30 * 60 * 1000; // 30min p/ "no prazo" como heurística simples

      for (const c of data as any[]) {
        if (c.status === 'pending') pending++;
        if (c.status === 'open') open++;
        if ((c.status === 'resolved' || c.status === 'closed') && (c.resolved_at || c.closed_at)) {
          const finishedAt = c.resolved_at || c.closed_at;
          if (finishedAt >= startOfTodayIso) resolvedToday++;
        }
        if (c.first_response_at && c.opened_at) {
          tmeSum += new Date(c.first_response_at).getTime() - new Date(c.opened_at).getTime();
          tmeCount++;
        }
        if ((c.resolved_at || c.closed_at) && c.opened_at) {
          tmaSum += new Date(c.resolved_at || c.closed_at).getTime() - new Date(c.opened_at).getTime();
          tmaCount++;
        }
      }

      // SLA% simplificado: % dos que tiveram first_response em <= 30min
      let onTrack = 0;
      for (const c of data as any[]) {
        if (c.first_response_at && c.opened_at) {
          const delta = new Date(c.first_response_at).getTime() - new Date(c.opened_at).getTime();
          if (delta <= breachedThreshold) onTrack++;
        }
      }
      const slaPct = tmeCount > 0 ? Math.round((onTrack / tmeCount) * 100) : 0;

      return {
        tme_seconds: tmeCount > 0 ? Math.round(tmeSum / tmeCount / 1000) : null,
        tma_seconds: tmaCount > 0 ? Math.round(tmaSum / tmaCount / 1000) : null,
        sla_pct: slaPct,
        total_24h: data.length,
        pending,
        open,
        resolved_today: resolvedToday,
      };
    },
    refetchInterval: 30 * 1000,
  });
}

export interface VolumeBucket { hour: string; count: number; }
export function useVolumeLast24h() {
  return useQuery<VolumeBucket[]>({
    queryKey: ['tv-volume-24h'],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('chat_conversations')
        .select('created_at')
        .gte('created_at', since24h);

      // bucket por hora
      const buckets = new Map<string, number>();
      const now = new Date();
      // pré-popula 24 buckets
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        const key = `${d.getHours().toString().padStart(2, '0')}h`;
        buckets.set(key, 0);
      }
      for (const c of data ?? []) {
        const d = new Date((c as any).created_at);
        const key = `${d.getHours().toString().padStart(2, '0')}h`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
      return Array.from(buckets.entries()).map(([hour, count]) => ({ hour, count }));
    },
    refetchInterval: 60 * 1000,
  });
}

export interface TopClient {
  client_id: string;
  client_name: string;
  conv_24h: number;
  resolved_pct: number;
}

export function useTopClientsByVolume() {
  return useQuery<TopClient[]>({
    queryKey: ['tv-top-clients'],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: convs } = await supabase
        .from('chat_conversations')
        .select('client_id, status')
        .gte('created_at', since24h);

      const map = new Map<string, { total: number; resolved: number }>();
      for (const c of convs ?? []) {
        const cid = String((c as any).client_id);
        if (!map.has(cid)) map.set(cid, { total: 0, resolved: 0 });
        const entry = map.get(cid)!;
        entry.total++;
        if ((c as any).status === 'resolved' || (c as any).status === 'closed') entry.resolved++;
      }

      const ids = Array.from(map.keys());
      const names = new Map<string, string>();
      if (ids.length > 0) {
        try {
          const { data: settings } = await supabase
            .from('chat_client_settings')
            .select('client_id, client_name')
            .in('client_id', ids);
          for (const s of settings ?? []) {
            names.set(String((s as any).client_id), (s as any).client_name || `Cliente ${(s as any).client_id}`);
          }
        } catch { /* noop */ }
      }

      return Array.from(map.entries())
        .map(([client_id, e]) => ({
          client_id,
          client_name: names.get(client_id) || `Cliente ${client_id}`,
          conv_24h: e.total,
          resolved_pct: e.total > 0 ? Math.round((e.resolved / e.total) * 100) : 0,
        }))
        .sort((a, b) => b.conv_24h - a.conv_24h)
        .slice(0, 10);
    },
    refetchInterval: 60 * 1000,
  });
}

export interface ChannelHealth {
  channel: string;
  label: string;
  message_count_24h: number;
  error_pct: number;
}

export function useChannelHealth() {
  return useQuery<ChannelHealth[]>({
    queryKey: ['tv-channel-health'],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const labels: Record<string, string> = {
        whatsapp_uazapi: 'WhatsApp UaZapi',
        whatsapp_waba: 'WhatsApp WABA',
        webchat: 'WebChat',
        instagram: 'Instagram',
        unknown: 'Outros',
      };

      // Contagens server-side (head:true => não baixa linhas, sem teto de 1000)
      const knownChannels = ['whatsapp_uazapi', 'whatsapp_waba', 'webchat', 'instagram'];
      const counts = new Map<string, number>();

      const [totalRes, ...perChannelRes] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .gte('timestamp', since24h),
        ...knownChannels.map((ch) =>
          supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel_type', ch)
            .gte('timestamp', since24h)
        ),
      ]);

      let knownSum = 0;
      knownChannels.forEach((ch, i) => {
        const n = perChannelRes[i]?.count ?? 0;
        if (n > 0) counts.set(ch, n);
        knownSum += n;
      });
      const totalAll = totalRes?.count ?? 0;
      const others = Math.max(0, totalAll - knownSum);
      if (others > 0) counts.set('unknown', others);

      // error_pct UaZapi: contagem server-side de runs com error not null vs total
      let errorPctByChannel = new Map<string, number>();
      try {
        const [runsTotalRes, runsErrRes] = await Promise.all([
          supabase
            .from('uazapi_history_runs' as never)
            .select('id', { count: 'exact', head: true })
            .gte('received_at', since24h) as any,
          supabase
            .from('uazapi_history_runs' as never)
            .select('id', { count: 'exact', head: true })
            .gte('received_at', since24h)
            .not('error', 'is', null) as any,
        ]);
        const total = runsTotalRes?.count ?? 0;
        const errs = runsErrRes?.count ?? 0;
        if (total > 0) errorPctByChannel.set('whatsapp_uazapi', Math.round((errs / total) * 100));
      } catch { /* noop */ }

      return Array.from(counts.entries()).map(([ch, count]) => ({
        channel: ch,
        label: labels[ch] || ch,
        message_count_24h: count,
        error_pct: errorPctByChannel.get(ch) ?? 0,
      })).sort((a, b) => b.message_count_24h - a.message_count_24h);
    },
    refetchInterval: 60 * 1000,
  });
}

export interface CsatStats {
  avg: number | null;
  total: number;
  trend7d: number[];
}

export function useCsatStats() {
  return useQuery<CsatStats>({
    queryKey: ['tv-csat-stats'],
    queryFn: async () => {
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      try {
        const { data } = await supabase
          .from('chat_csat_responses' as never)
          .select('score, responded_at')
          .gte('responded_at', since7d) as any;
        if (!data || data.length === 0) return { avg: null, total: 0, trend7d: Array(7).fill(0) };
        const sum = data.reduce((a: number, r: any) => a + (r.score || 0), 0);
        const avg = data.length > 0 ? Math.round((sum / data.length) * 10) / 10 : null;

        // Buckets por dia
        const trend = Array(7).fill(0).map(() => ({ sum: 0, count: 0 }));
        const now = new Date();
        for (const r of data) {
          const d = new Date(r.responded_at);
          const dayDiff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
          if (dayDiff >= 0 && dayDiff < 7) {
            trend[6 - dayDiff].sum += r.score;
            trend[6 - dayDiff].count += 1;
          }
        }
        return {
          avg,
          total: data.length,
          trend7d: trend.map((t) => t.count > 0 ? Math.round((t.sum / t.count) * 10) / 10 : 0),
        };
      } catch {
        return { avg: null, total: 0, trend7d: Array(7).fill(0) };
      }
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

export interface AgentLoad {
  agent_identifier: string;
  agent_name: string;
  status: string;
  current_load: number;
  max_concurrent: number;
}

export function useAgentLoads() {
  return useQuery<AgentLoad[]>({
    queryKey: ['tv-agent-loads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_agent_capacity' as never)
        .select('agent_identifier, agent_name, status, current_load, max_concurrent, is_active')
        .eq('is_active', true)
        .order('current_load', { ascending: false })
        .limit(10) as any;
      return (data ?? []) as AgentLoad[];
    },
    refetchInterval: 30 * 1000,
  });
}
