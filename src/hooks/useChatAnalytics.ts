import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AnalyticsFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  channel?: string;
  agent?: string;
}

export interface AnalyticsSummary {
  totalConversations: number;
  newConversations: number;
  resolvedConversations: number;
  pendingConversations: number;
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  avgFirstResponseSeconds: number | null;
  avgResolutionSeconds: number | null;
  slaCompliancePct: number | null;
  csatAvg: number | null;
  csatResponses: number;
  byChannel: Record<string, number>;
  byAgent: Record<string, number>;
  byTag: Record<string, number>;
  byDay: { date: string; conversations: number; resolved: number; messages: number }[];
}

const SECONDS = (a: string | null, b: string | null) => {
  if (!a || !b) return null;
  return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 1000));
};

export function useChatAnalytics(filters: AnalyticsFilters) {
  const { user } = useAuth();
  const clientId = user?.cod_client || user?.codAgent || 'default';

  return useQuery({
    queryKey: ['chat-analytics', clientId, filters],
    queryFn: async (): Promise<AnalyticsSummary> => {
      const start = new Date(`${filters.startDate}T00:00:00`).toISOString();
      const end = new Date(`${filters.endDate}T23:59:59`).toISOString();

      let convQuery = supabase
        .from('chat_conversations')
        .select('id, status, channel, assigned_to, opened_at, first_response_at, resolved_at, closed_at, tags, created_at')
        .eq('client_id', clientId)
        .gte('created_at', start)
        .lte('created_at', end);
      if (filters.channel) convQuery = convQuery.eq('channel', filters.channel);
      if (filters.agent) convQuery = convQuery.eq('assigned_to', filters.agent);

      const { data: conversations = [] } = await convQuery;

      const { data: messages = [] } = await supabase
        .from('chat_messages')
        .select('id, from_me, created_at, contact_id, conversation_id')
        .eq('client_id', clientId)
        .gte('created_at', start)
        .lte('created_at', end);

      const { data: csat = [] } = await supabase
        .from('chat_csat_responses')
        .select('score, status')
        .eq('client_id', clientId)
        .gte('sent_at', start)
        .lte('sent_at', end);

      const byChannel: Record<string, number> = {};
      const byAgent: Record<string, number> = {};
      const byTag: Record<string, number> = {};
      const byDayMap: Record<string, { conversations: number; resolved: number; messages: number }> = {};

      let firstResponseSum = 0;
      let firstResponseCount = 0;
      let resolutionSum = 0;
      let resolutionCount = 0;
      let slaOk = 0;
      let slaTotal = 0;

      for (const c of conversations) {
        byChannel[c.channel] = (byChannel[c.channel] || 0) + 1;
        if (c.assigned_to) byAgent[c.assigned_to] = (byAgent[c.assigned_to] || 0) + 1;
        (c.tags || []).forEach((t: string) => { byTag[t] = (byTag[t] || 0) + 1; });

        const day = (c.created_at || '').slice(0, 10);
        byDayMap[day] = byDayMap[day] || { conversations: 0, resolved: 0, messages: 0 };
        byDayMap[day].conversations++;
        if (c.status === 'resolved' || c.resolved_at) byDayMap[day].resolved++;

        const fr = SECONDS(c.opened_at, c.first_response_at);
        if (fr !== null) { firstResponseSum += fr; firstResponseCount++; slaTotal++; if (fr <= 900) slaOk++; }
        const res = SECONDS(c.opened_at, c.resolved_at || c.closed_at);
        if (res !== null) { resolutionSum += res; resolutionCount++; }
      }

      let inboundMessages = 0;
      let outboundMessages = 0;
      for (const m of messages) {
        if (m.from_me) outboundMessages++; else inboundMessages++;
        const day = (m.created_at || '').slice(0, 10);
        if (byDayMap[day]) byDayMap[day].messages++;
      }

      const csatScores = csat.filter(r => r.status === 'responded' && typeof r.score === 'number').map(r => r.score);

      return {
        totalConversations: conversations.length,
        newConversations: conversations.length,
        resolvedConversations: conversations.filter(c => c.status === 'resolved' || c.resolved_at).length,
        pendingConversations: conversations.filter(c => c.status === 'pending').length,
        totalMessages: messages.length,
        inboundMessages,
        outboundMessages,
        avgFirstResponseSeconds: firstResponseCount ? Math.round(firstResponseSum / firstResponseCount) : null,
        avgResolutionSeconds: resolutionCount ? Math.round(resolutionSum / resolutionCount) : null,
        slaCompliancePct: slaTotal ? Math.round((slaOk / slaTotal) * 100) : null,
        csatAvg: csatScores.length ? Number((csatScores.reduce((a, b) => a + b, 0) / csatScores.length).toFixed(2)) : null,
        csatResponses: csatScores.length,
        byChannel,
        byAgent,
        byTag,
        byDay: Object.entries(byDayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
      };
    },
  });
}
