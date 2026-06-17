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
      const [sessionsRes, chatRes, phoneRes] = await Promise.all([
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
      ]);

      const sessions = (sessionsRes as any).data || [];
      const chat = (chatRes as any).data || [];
      const phone = (phoneRes as any).data || [];

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

      // Sessions → user + day
      const handleAvgAcc: Record<number, { sum: number; count: number }> = {};
      for (const r of sessions as any[]) {
        const uid = Number(r.user_id);
        if (!byUser[uid]) continue;
        const d = String(r.day_brt);
        byUser[uid].worked_seconds += Number(r.worked_seconds) || 0;
        byUser[uid].sessions_count += Number(r.sessions_count) || 0;
        if (userDays[uid][d]) userDays[uid][d].worked_seconds += Number(r.worked_seconds) || 0;
        if (totalDays[d]) totalDays[d].worked_seconds += Number(r.worked_seconds) || 0;
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

const MAX_SESSION_SECONDS = 12 * 3600;

export function useUserSessions(userId: number | null, period: PerformancePeriod) {
  return useQuery<UserSessionRow[]>({
    queryKey: ['user-sessions', userId, period.startDate, period.endDate],
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
        .order('created_at', { ascending: true });
      if (error) throw error;

      const events = ((data || []) as Array<{ event_type: string; occurred_at: string | null; created_at: string }>)
        .map((e) => ({ type: e.event_type, at: e.occurred_at || e.created_at }))
        .sort((a, b) => a.at.localeCompare(b.at));

      const rows: UserSessionRow[] = [];
      let pendingLogin: string | null = null;
      const now = new Date().toISOString();

      for (const ev of events) {
        if (ev.type === 'login') {
          if (pendingLogin) {
            // login sem logout pareado anterior — fecha como aberto/desconhecido
            rows.push({ login_at: pendingLogin, logout_at: null, logout_type: null, duration_seconds: null, open: true });
          }
          pendingLogin = ev.at;
        } else if (ev.type === 'logout_manual' || ev.type === 'logout_inactivity') {
          if (pendingLogin) {
            const dur = Math.min(
              MAX_SESSION_SECONDS,
              Math.max(0, Math.floor((new Date(ev.at).getTime() - new Date(pendingLogin).getTime()) / 1000)),
            );
            rows.push({
              login_at: pendingLogin,
              logout_at: ev.at,
              logout_type: ev.type as any,
              duration_seconds: dur,
              open: false,
            });
            pendingLogin = null;
          }
          // logout órfão é ignorado
        }
      }
      if (pendingLogin) {
        const dur = Math.min(
          MAX_SESSION_SECONDS,
          Math.max(0, Math.floor((new Date(now).getTime() - new Date(pendingLogin).getTime()) / 1000)),
        );
        rows.push({ login_at: pendingLogin, logout_at: null, logout_type: null, duration_seconds: dur, open: true });
      }

      return rows.reverse(); // mais recente primeiro
    },
  });
}