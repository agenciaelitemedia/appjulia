import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMembers } from './useEquipeData';

export interface PerformancePeriod {
  /** YYYY-MM-DD (BRT) inclusive */
  startDate: string;
  /** YYYY-MM-DD (BRT) inclusive */
  endDate: string;
}

export interface PerformanceMember {
  id: number;
  name: string;
  email?: string;
  photo?: string | null;
}

export interface PerformanceDailyRow {
  day: string; // YYYY-MM-DD
  worked_seconds: number;
  received: number;
  resolved: number;
  returned: number;
  transferred: number;
  calls_total: number;
  talk_seconds: number;
}

export interface PerformanceUserRow {
  user_id: number;
  name: string;
  photo?: string | null;
  worked_seconds: number;
  sessions_count: number;
  received: number;
  resolved: number;
  returned: number;
  transferred: number;
  avg_handle_seconds: number | null;
  calls_total: number;
  calls_answered: number;
  calls_outbound: number;
  talk_seconds: number;
  unique_numbers: number;
  calls_to_known_leads: number;
  occupancy_pct: number;
  resolution_rate: number;
  /** sparkline last 14 entries of received */
  trend_received: number[];
  /** per-day breakdown for this user (period range) */
  byDay: PerformanceDailyRow[];
}

export interface PerformanceResult {
  members: PerformanceUserRow[];
  byDayTotal: PerformanceDailyRow[];
  totals: Omit<PerformanceUserRow, 'user_id' | 'name' | 'photo' | 'trend_received' | 'byDay'>;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayRange(start: string, end: string): string[] {
  const days: string[] = [];
  let cur = start;
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

function normName(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}

export function useTeamPerformance(
  period: PerformancePeriod,
  selectedUserIds: number[] | null = null,
) {
  const { user } = useAuth();
  const { data: members = [], isLoading: loadingMembers } = useTeamMembers();

  const allMembers: PerformanceMember[] = useMemo(() => {
    const list: PerformanceMember[] = members.map((m: any) => ({
      id: Number(m.id),
      name: m.name,
      email: m.email,
      photo: m.photo,
    }));
    if (user?.id) {
      list.unshift({
        id: Number(user.id),
        name: user.name,
        email: user.email,
        photo: user.avatar || null,
      });
    }
    // dedup
    const seen = new Set<number>();
    return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }, [members, user]);

  const clientIdNum = user?.client_id ? Number(user.client_id) : null;
  const clientIdText = clientIdNum ? String(clientIdNum) : '';

  const userIds = useMemo(() => allMembers.map((m) => m.id), [allMembers]);
  const userNames = useMemo(
    () => [...new Set(allMembers.map((m) => (m.name || '').trim()).filter(Boolean))],
    [allMembers],
  );
  const nameToId = useMemo(() => {
    const m: Record<string, number> = {};
    for (const x of allMembers) m[normName(x.name)] = x.id;
    return m;
  }, [allMembers]);

  const query = useQuery<PerformanceResult>({
    queryKey: [
      'team-performance',
      clientIdNum,
      period.startDate,
      period.endDate,
      userIds.join(','),
      (selectedUserIds || []).join(','),
    ],
    enabled: !!clientIdNum && userIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      // Para tempo online: dias passados vêm do agregado `user_presence_daily`;
      // apenas o dia de hoje (janela "quente") é calculado on the fly nos heartbeats brutos.
      const todayBrt = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
      const hotFromIso = new Date(`${todayBrt}T00:00:00-03:00`).toISOString();
      const hotToIso = new Date(`${todayBrt}T23:59:59-03:00`).toISOString();
      const includesToday = period.endDate >= todayBrt;

      const [sessionsRes, chatRes, phoneRes, heartbeatsRes, presenceDailyRes] = await Promise.all([
        supabase
          .from('mv_user_sessions_daily' as any)
          .select('user_id, user_name, day_brt, worked_seconds, sessions_count')
          .eq('client_id', clientIdNum!)
          .in('user_id', userIds as any)
          .gte('day_brt', period.startDate)
          .lte('day_brt', period.endDate),
        userNames.length > 0
          ? supabase
              .from('mv_user_chat_daily' as any)
              .select('user_name, day_brt, received, resolved, returned, transferred, avg_handle_seconds')
              .eq('client_id', clientIdText)
              .in('user_name', userNames)
              .gte('day_brt', period.startDate)
              .lte('day_brt', period.endDate)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('mv_user_phone_daily' as any)
          .select('user_id, day_brt, calls_total, calls_answered, calls_outbound, talk_seconds, unique_numbers, calls_to_known_leads')
          .eq('client_id', clientIdText)
          .in('user_id', userIds as any)
          .gte('day_brt', period.startDate)
          .lte('day_brt', period.endDate),
        // Janela "quente" (hoje): heartbeats brutos = 30s por slot.
        includesToday
          ? supabase
              .from('user_presence_heartbeats' as any)
              .select('user_id, seen_at')
              .in('user_id', userIds as any)
              .gte('seen_at', hotFromIso)
              .lte('seen_at', hotToIso)
          : Promise.resolve({ data: [] as any[] }),
        // Janela "fria" (<= ontem): agregado diário consolidado.
        supabase
          .from('user_presence_daily' as any)
          .select('user_id, day_brt, online_seconds')
          .in('user_id', userIds as any)
          .gte('day_brt', period.startDate)
          .lt('day_brt', todayBrt),
      ]);

      const sessions = (sessionsRes as any).data || [];
      const chat = (chatRes as any).data || [];
      const phone = (phoneRes as any).data || [];
      const heartbeats = (heartbeatsRes as any).data || [];
      const presenceDaily = (presenceDailyRes as any).data || [];

      // Initialize per-user accumulator
      const byUser: Record<number, PerformanceUserRow> = {};
      for (const m of allMembers) {
        byUser[m.id] = emptyUserRow(m.id, m.name, m.photo);
      }

      // Per-day accumulator (per user, then total)
      const dayKeys = dayRange(period.startDate, period.endDate);
      const dayInit = () => Object.fromEntries(dayKeys.map((d) => [d, emptyDailyRow(d)])) as Record<string, PerformanceDailyRow>;
      const userDays: Record<number, Record<string, PerformanceDailyRow>> = {};
      for (const m of allMembers) userDays[m.id] = dayInit();
      const totalDays: Record<string, PerformanceDailyRow> = dayInit();

      // Sessions (login/logout) — usados apenas para sessions_count.
      const handleAvgAcc: Record<number, { sum: number; count: number }> = {};
      for (const r of sessions as any[]) {
        const uid = Number(r.user_id);
        if (!byUser[uid]) continue;
        byUser[uid].sessions_count += Number(r.sessions_count) || 0;
      }

      // Tempo online — dias passados (agregado) + hoje (heartbeats).
      const dayOnlineSecs: Record<number, Record<string, number>> = {};

      // 1) Dias frios via agregado já consolidado.
      for (const r of presenceDaily as Array<{ user_id: number; day_brt: string; online_seconds: number }>) {
        const uid = Number(r.user_id);
        if (!byUser[uid]) continue;
        const userMap = (dayOnlineSecs[uid] ||= {});
        userMap[r.day_brt] = (userMap[r.day_brt] || 0) + (Number(r.online_seconds) || 0);
      }

      // 2) Hoje via heartbeats brutos (dedup por slot 30s).
      const seenSlots: Record<number, Set<string>> = {};
      for (const r of heartbeats as Array<{ user_id: number; seen_at: string }>) {
        const uid = Number(r.user_id);
        if (!byUser[uid]) continue;
        const t = new Date(r.seen_at);
        if (Number.isNaN(t.getTime())) continue;
        const slotKey = String(Math.floor(t.getTime() / 30000));
        const set = (seenSlots[uid] ||= new Set());
        if (set.has(slotKey)) continue;
        set.add(slotKey);
        const userMap = (dayOnlineSecs[uid] ||= {});
        userMap[todayBrt] = (userMap[todayBrt] || 0) + 30;
      }
      for (const uid of Object.keys(byUser).map(Number)) {
        const userMap = dayOnlineSecs[uid] || {};
        let total = 0;
        for (const [d, s] of Object.entries(userMap)) {
          total += s;
          if (userDays[uid][d]) userDays[uid][d].worked_seconds += s;
          if (totalDays[d]) totalDays[d].worked_seconds += s;
        }
        byUser[uid].worked_seconds = total;
      }

      // Chat → match by name
      for (const r of chat as any[]) {
        const uid = nameToId[normName(r.user_name)];
        if (!uid || !byUser[uid]) continue;
        const d = String(r.day_brt);
        byUser[uid].received += Number(r.received) || 0;
        byUser[uid].resolved += Number(r.resolved) || 0;
        byUser[uid].returned += Number(r.returned) || 0;
        byUser[uid].transferred += Number(r.transferred) || 0;
        if (r.avg_handle_seconds != null) {
          handleAvgAcc[uid] = handleAvgAcc[uid] || { sum: 0, count: 0 };
          handleAvgAcc[uid].sum += Number(r.avg_handle_seconds);
          handleAvgAcc[uid].count += 1;
        }
        if (userDays[uid][d]) {
          userDays[uid][d].received += Number(r.received) || 0;
          userDays[uid][d].resolved += Number(r.resolved) || 0;
          userDays[uid][d].returned += Number(r.returned) || 0;
          userDays[uid][d].transferred += Number(r.transferred) || 0;
        }
        if (totalDays[d]) {
          totalDays[d].received += Number(r.received) || 0;
          totalDays[d].resolved += Number(r.resolved) || 0;
          totalDays[d].returned += Number(r.returned) || 0;
          totalDays[d].transferred += Number(r.transferred) || 0;
        }
      }

      // Phone → user + day
      for (const r of phone as any[]) {
        const uid = Number(r.user_id);
        if (!byUser[uid]) continue;
        const d = String(r.day_brt);
        byUser[uid].calls_total += Number(r.calls_total) || 0;
        byUser[uid].calls_answered += Number(r.calls_answered) || 0;
        byUser[uid].calls_outbound += Number(r.calls_outbound) || 0;
        byUser[uid].talk_seconds += Number(r.talk_seconds) || 0;
        byUser[uid].unique_numbers += Number(r.unique_numbers) || 0;
        byUser[uid].calls_to_known_leads += Number(r.calls_to_known_leads) || 0;
        if (userDays[uid][d]) {
          userDays[uid][d].calls_total += Number(r.calls_total) || 0;
          userDays[uid][d].talk_seconds += Number(r.talk_seconds) || 0;
        }
        if (totalDays[d]) {
          totalDays[d].calls_total += Number(r.calls_total) || 0;
          totalDays[d].talk_seconds += Number(r.talk_seconds) || 0;
        }
      }

      // Compute derived metrics
      for (const uid of Object.keys(byUser).map(Number)) {
        const u = byUser[uid];
        const acc = handleAvgAcc[uid];
        u.avg_handle_seconds = acc && acc.count > 0 ? Math.round(acc.sum / acc.count) : null;
        u.occupancy_pct = u.worked_seconds > 0
          ? Math.min(100, Math.round((u.talk_seconds / u.worked_seconds) * 100))
          : 0;
        u.resolution_rate = u.received > 0 ? Math.round((u.resolved / u.received) * 100) : 0;
        // Sparkline: last up to 14 days received
        const days = Object.values(userDays[uid]).sort((a, b) => a.day.localeCompare(b.day));
        u.trend_received = days.slice(-14).map((d) => d.received);
        u.byDay = days;
      }

      // Filter selection
      let resultMembers = Object.values(byUser);
      if (selectedUserIds && selectedUserIds.length > 0) {
        const set = new Set(selectedUserIds.map(Number));
        resultMembers = resultMembers.filter((m) => set.has(m.user_id));
      }
      resultMembers.sort((a, b) => b.received - a.received || b.worked_seconds - a.worked_seconds);

      // Totals
      const totals = resultMembers.reduce(
        (acc, m) => ({
          worked_seconds: acc.worked_seconds + m.worked_seconds,
          sessions_count: acc.sessions_count + m.sessions_count,
          received: acc.received + m.received,
          resolved: acc.resolved + m.resolved,
          returned: acc.returned + m.returned,
          transferred: acc.transferred + m.transferred,
          avg_handle_seconds: null as number | null,
          calls_total: acc.calls_total + m.calls_total,
          calls_answered: acc.calls_answered + m.calls_answered,
          calls_outbound: acc.calls_outbound + m.calls_outbound,
          talk_seconds: acc.talk_seconds + m.talk_seconds,
          unique_numbers: acc.unique_numbers + m.unique_numbers,
          calls_to_known_leads: acc.calls_to_known_leads + m.calls_to_known_leads,
          occupancy_pct: 0,
          resolution_rate: 0,
        }),
        {
          worked_seconds: 0, sessions_count: 0, received: 0, resolved: 0, returned: 0,
          transferred: 0, avg_handle_seconds: null, calls_total: 0, calls_answered: 0,
          calls_outbound: 0, talk_seconds: 0, unique_numbers: 0, calls_to_known_leads: 0,
          occupancy_pct: 0, resolution_rate: 0,
        },
      );
      totals.occupancy_pct = totals.worked_seconds > 0
        ? Math.min(100, Math.round((totals.talk_seconds / totals.worked_seconds) * 100))
        : 0;
      totals.resolution_rate = totals.received > 0
        ? Math.round((totals.resolved / totals.received) * 100)
        : 0;

      // Per-day totals (if user filter applied, recompute from selected users)
      let byDayTotal: PerformanceDailyRow[];
      if (selectedUserIds && selectedUserIds.length > 0) {
        const filtered = dayInit();
        for (const m of resultMembers) {
          for (const d of m.byDay) {
            const f = filtered[d.day];
            f.worked_seconds += d.worked_seconds;
            f.received += d.received;
            f.resolved += d.resolved;
            f.returned += d.returned;
            f.transferred += d.transferred;
            f.calls_total += d.calls_total;
            f.talk_seconds += d.talk_seconds;
          }
        }
        byDayTotal = Object.values(filtered).sort((a, b) => a.day.localeCompare(b.day));
      } else {
        byDayTotal = Object.values(totalDays).sort((a, b) => a.day.localeCompare(b.day));
      }

      return { members: resultMembers, byDayTotal, totals };
    },
  });

  return {
    ...query,
    allMembers,
    isLoadingMembers: loadingMembers,
  };
}

function emptyUserRow(id: number, name: string, photo?: string | null): PerformanceUserRow {
  return {
    user_id: id, name, photo,
    worked_seconds: 0, sessions_count: 0,
    received: 0, resolved: 0, returned: 0, transferred: 0,
    avg_handle_seconds: null,
    calls_total: 0, calls_answered: 0, calls_outbound: 0,
    talk_seconds: 0, unique_numbers: 0, calls_to_known_leads: 0,
    occupancy_pct: 0, resolution_rate: 0,
    trend_received: [], byDay: [],
  };
}

function emptyDailyRow(day: string): PerformanceDailyRow {
  return {
    day, worked_seconds: 0, received: 0, resolved: 0,
    returned: 0, transferred: 0, calls_total: 0, talk_seconds: 0,
  };
}

export interface TopNumberRow {
  phone_normalized: string;
  phone_display: string;
  call_count: number;
  total_seconds: number;
  last_call_at: string;
  is_known_lead: boolean;
}

export function useUserTopNumbers(userId: number | null, period: PerformancePeriod) {
  const { user } = useAuth();
  const clientIdText = user?.client_id ? String(user.client_id) : '';

  return useQuery<TopNumberRow[]>({
    queryKey: ['team-performance-top-numbers', clientIdText, userId, period.startDate, period.endDate],
    enabled: !!userId && !!clientIdText,
    queryFn: async () => {
      const { data } = await supabase
        .from('mv_user_phone_top_numbers' as any)
        .select('phone_normalized, phone_display, call_count, total_seconds, last_call_at, is_known_lead')
        .eq('client_id', clientIdText)
        .eq('user_id', userId!)
        .gte('day_brt', period.startDate)
        .lte('day_brt', period.endDate)
        .order('call_count', { ascending: false })
        .limit(50);

      // Aggregate across days (same phone shown multiple times if called multiple days)
      const map = new Map<string, TopNumberRow>();
      for (const r of (data || []) as any[]) {
        const key = r.phone_normalized || r.phone_display;
        const existing = map.get(key);
        if (existing) {
          existing.call_count += Number(r.call_count) || 0;
          existing.total_seconds += Number(r.total_seconds) || 0;
          if (r.last_call_at > existing.last_call_at) existing.last_call_at = r.last_call_at;
        } else {
          map.set(key, {
            phone_normalized: r.phone_normalized,
            phone_display: r.phone_display,
            call_count: Number(r.call_count) || 0,
            total_seconds: Number(r.total_seconds) || 0,
            last_call_at: r.last_call_at,
            is_known_lead: !!r.is_known_lead,
          });
        }
      }
      return Array.from(map.values())
        .sort((a, b) => b.call_count - a.call_count || b.total_seconds - a.total_seconds)
        .slice(0, 20);
    },
  });
}

// ============================================================
// User sessions (login/logout pairs) for the period
// ============================================================

export interface UserSessionRow {
  login_at: string;
  logout_at: string | null;
  logout_type: 'logout_manual' | 'logout_inactivity' | null;
  duration_seconds: number | null;
  open: boolean;
}

/** Gap máximo (s) entre heartbeats consecutivos para serem considerados a mesma sessão. */
const SESSION_GAP_SECONDS = 120;
const SLOT_SECONDS = 30;

export function useUserSessions(userId: number | null, period: PerformancePeriod) {
  return useQuery<UserSessionRow[]>({
    queryKey: ['user-sessions-hb', userId, period.startDate, period.endDate],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const fromIso = new Date(`${period.startDate}T00:00:00-03:00`).toISOString();
      const toIso = new Date(`${period.endDate}T23:59:59-03:00`).toISOString();

      // Sessões reais derivadas de heartbeats: 1 slot = 30s.
      // Agrupa slots consecutivos com gap <= 2 min como uma única sessão.
      const { data, error } = await (supabase as any)
        .from('user_presence_heartbeats')
        .select('seen_at')
        .eq('user_id', userId!)
        .gte('seen_at', fromIso)
        .lte('seen_at', toIso)
        .order('seen_at', { ascending: true })
        .limit(20000);
      if (error) throw error;

      const slots = ((data || []) as Array<{ seen_at: string }>)
        .map((r) => Math.floor(new Date(r.seen_at).getTime() / 1000))
        .sort((a, b) => a - b);
      if (slots.length === 0) return [];

      const rows: UserSessionRow[] = [];
      const nowSec = Math.floor(Date.now() / 1000);
      let start = slots[0];
      let prev = slots[0];
      let count = 1;
      const flush = () => {
        const end = prev + SLOT_SECONDS;
        const open = nowSec - prev <= SESSION_GAP_SECONDS;
        rows.push({
          login_at: new Date(start * 1000).toISOString(),
          logout_at: open ? null : new Date(end * 1000).toISOString(),
          logout_type: open ? null : 'logout_inactivity',
          duration_seconds: count * SLOT_SECONDS,
          open,
        });
      };
      for (let i = 1; i < slots.length; i++) {
        const s = slots[i];
        if (s - prev > SESSION_GAP_SECONDS) {
          flush();
          start = s;
          count = 1;
        } else if (s !== prev) {
          count += 1;
        }
        prev = s;
      }
      flush();
      return rows.reverse(); // mais recente primeiro
    },
  });
}

// ============================================================
// Eventos brutos de auth (login/logout) — auditoria secundária
// ============================================================

export interface AuthEventRow { type: string; at: string }

export function useUserAuthEvents(userId: number | null, period: PerformancePeriod) {
  return useQuery<AuthEventRow[]>({
    queryKey: ['user-auth-events', userId, period.startDate, period.endDate],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const fromIso = new Date(`${period.startDate}T00:00:00-03:00`).toISOString();
      const toIso = new Date(`${period.endDate}T23:59:59-03:00`).toISOString();
      const { data, error } = await (supabase as any)
        .from('user_activity_log')
        .select('event_type, occurred_at, created_at')
        .eq('user_id', userId!)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as Array<{ event_type: string; occurred_at: string | null; created_at: string }>)
        .map((e) => ({ type: e.event_type, at: e.occurred_at || e.created_at }));
    },
  });
}

// ============================================================
// Data-limite do backfill aproximado (login/logout). Dias <= esta
// data são "Estimado"; dias posteriores são medidos por heartbeats.
// ============================================================
export function usePresenceBackfillUntil(): string | null {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';
  const { data } = useQuery<string | null>({
    queryKey: ['presence-backfill-until', clientId],
    enabled: !!clientId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_client_settings')
        .select('settings')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) return null;
      const s = (data?.settings as Record<string, unknown> | undefined) || {};
      const v = s['presence_backfill_until'];
      return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    },
  });
  return data ?? null;
}