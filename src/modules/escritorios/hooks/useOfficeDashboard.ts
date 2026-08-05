import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import { useOfficeClientId } from './useOfficeClientId';

export interface OfficeDashboardStats {
  open: number;
  pending: number;
  resolved: number;
  total: number;
  unassigned: number;
  messagesIn: number;
  messagesOut: number;
  avgFirstResponseMin: number | null;
  byChannel: { channel: string; count: number }[];
  byQueue: { queue: string; count: number }[];
  byDay: { day: string; count: number }[];
  topAgents: { agent: string; count: number }[];
}

export interface OfficePeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

function eachDay(period: OfficePeriod): string[] {
  const out: string[] = [];
  const start = new Date(`${period.startDate}T00:00:00`);
  const end = new Date(`${period.endDate}T00:00:00`);
  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
    if (out.length > 400) break;
  }
  return out;
}

export function useOfficeDashboard(period: OfficePeriod) {
  const { data: clientId } = useOfficeClientId();

  return useQuery<OfficeDashboardStats>({
    queryKey: ['escritorios', 'dashboard', clientId, period.startDate, period.endDate],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(`${period.startDate}T00:00:00`).toISOString();
      const until = new Date(`${period.endDate}T23:59:59.999`).toISOString();

      const [convRes, msgRes, queueRes] = await Promise.all([
        supabase
          .from('chat_conversations')
          .select('id, status, channel, queue_id, assigned_to, created_at, opened_at, first_response_at')
          .eq('client_id', clientId!)
          .gte('created_at', since)
          .lte('created_at', until)
          .limit(5000),
        supabase
          .from('chat_messages')
          .select('id, from_me, timestamp')
          .eq('client_id', clientId!)
          .gte('timestamp', since)
          .lte('timestamp', until)
          .limit(20000),
        supabase
          .from('queues')
          .select('id, name')
          .eq('client_id', clientId!)
          .eq('is_deleted', false),
      ]);

      if (convRes.error) throw convRes.error;
      if (msgRes.error) throw msgRes.error;

      const conversations = convRes.data || [];
      const messages = msgRes.data || [];
      const queueNames = new Map((queueRes.data || []).map((q: any) => [q.id, q.name]));

      const count = (fn: (c: any) => boolean) => conversations.filter(fn).length;

      const group = (items: any[], keyFn: (i: any) => string) => {
        const map = new Map<string, number>();
        for (const item of items) {
          const key = keyFn(item);
          map.set(key, (map.get(key) || 0) + 1);
        }
        return Array.from(map.entries())
          .map(([k, v]) => [k, v] as const)
          .sort((a, b) => b[1] - a[1]);
      };

      const firstResponses = conversations
        .filter((c: any) => c.first_response_at && (c.opened_at || c.created_at))
        .map((c: any) => {
          const start = new Date(c.opened_at || c.created_at).getTime();
          return (new Date(c.first_response_at).getTime() - start) / 60000;
        })
        .filter((v) => Number.isFinite(v) && v >= 0);

      const dayMap = new Map<string, number>();
      for (const day of eachDay(period)) dayMap.set(day, 0);
      for (const c of conversations) {
        const key = String(c.created_at).slice(0, 10);
        if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1);
      }

      return {
        open: count((c) => ['open', 'in_progress'].includes(String(c.status))),
        pending: count((c) => ['pending', 'waiting', 'snoozed'].includes(String(c.status))),
        resolved: count((c) => ['resolved', 'closed'].includes(String(c.status))),
        total: conversations.length,
        unassigned: count((c) => !c.assigned_to),
        messagesIn: messages.filter((m: any) => !m.from_me).length,
        messagesOut: messages.filter((m: any) => m.from_me).length,
        avgFirstResponseMin: firstResponses.length
          ? Math.round(firstResponses.reduce((a, b) => a + b, 0) / firstResponses.length)
          : null,
        byChannel: group(conversations, (c) => String(c.channel || 'outros')).map(([channel, cnt]) => ({
          channel,
          count: cnt,
        })),
        byQueue: group(conversations, (c) => queueNames.get(c.queue_id) || 'Sem fila').map(([queue, cnt]) => ({
          queue,
          count: cnt,
        })),
        byDay: Array.from(dayMap.entries()).map(([day, cnt]) => ({ day, count: cnt })),
        topAgents: group(
          conversations.filter((c: any) => c.assigned_to),
          (c) => String(c.assigned_to),
        )
          .slice(0, 5)
          .map(([agent, cnt]) => ({ agent, count: cnt })),
      };
    },
  });
}