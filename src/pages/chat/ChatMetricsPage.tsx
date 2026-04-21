import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line,
} from 'recharts';
import {
  Clock, MessageCircle, CheckCircle2, Users, Timer,
  ArrowLeft, Zap, AlertTriangle, BarChart3, Activity, Star, Download,
  TrendingUp, TrendingDown, Minus, RefreshCw, XCircle, ChevronUp, ChevronDown,
  PhoneOff, FileDown, Layers,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay, differenceInMinutes, parseISO, startOfWeek, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatHeatmap } from '@/components/chat/analytics/ChatHeatmap';
import { generateChatMetricsPdf } from '@/lib/chatPdfReport';
import { useChatSlaConfigs } from '@/hooks/useChatSlaConfigs';
import { cn } from '@/lib/utils';

interface ConversationRow {
  id: string;
  status: string;
  channel: string;
  assigned_to: string | null;
  opened_at: string;
  first_response_at: string | null;
  closed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  priority: string;
  department: string | null;
  contact_id: string;
  queue_id: string | null;
  protocol: string;
}

interface CsatRow {
  id: string;
  conversation_id: string;
  cod_agent: string | null;
  score: number;
  status: string;
  responded_at: string | null;
  feedback: string | null;
}

interface QueueRow { id: string; name: string }

interface LiveData {
  pending: number;
  open: number;
  slaAtRisk: number;
  slaBreached: number;
  lastRefresh: Date;
}

type Period = '7d' | '14d' | '30d' | '90d';
type SortField = 'total' | 'resolved' | 'resolutionRate' | 'avgFirst' | 'avgRes' | 'csatAvg' | 'abandonRate';
type SortDir = 'asc' | 'desc';

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp_uazapi: '#22c55e',
  whatsapp_waba: '#10b981',
  webchat: '#3b82f6',
  instagram: '#ec4899',
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp_uazapi: 'WhatsApp',
  whatsapp_waba: 'WABA',
  webchat: 'WebChat',
  instagram: 'Instagram',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  open: '#3b82f6',
  resolved: '#22c55e',
  closed: '#6b7280',
};

export default function ChatMetricsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { configs: slaConfigs } = useChatSlaConfigs();

  const slaTarget = useMemo(() => {
    const cfg = (slaConfigs || []).find((c: any) => c.metric === 'first_response' || c.sla_type === 'first_response');
    return (cfg as any)?.target_minutes ?? (cfg as any)?.first_response_minutes ?? 15;
  }, [slaConfigs]);

  const clientId = user?.client_id ? String(user.client_id) : null;

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [prevConversations, setPrevConversations] = useState<ConversationRow[]>([]);
  const [csatRows, setCsatRows] = useState<CsatRow[]>([]);
  const [queues, setQueues] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | null>(null);

  const [period, setPeriod] = useState<Period>('30d');
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [agentSortField, setAgentSortField] = useState<SortField>('total');
  const [agentSortDir, setAgentSortDir] = useState<SortDir>('desc');

  const periodDays = period === '7d' ? 7 : period === '14d' ? 14 : period === '30d' ? 30 : 90;
  const startDate = startOfDay(subDays(new Date(), periodDays));
  const endDate = endOfDay(new Date());
  const prevStart = startOfDay(subDays(startDate, periodDays));
  const prevEnd = endOfDay(subDays(endDate, periodDays));

  const LIMIT = 5000;

  // ─── Load queues ─────────────────────────────────────────────────
  const loadQueues = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase.from('queues').select('id, name')
      .eq('client_id', clientId).order('name');
    setQueues((data ?? []) as QueueRow[]);
  }, [clientId]);

  // ─── Load historical data ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const cols = 'id, status, channel, assigned_to, opened_at, first_response_at, closed_at, resolved_at, created_at, priority, department, contact_id, queue_id, protocol';

    const [{ data: cur }, { data: prev }, { data: csat }] = await Promise.all([
      supabase.from('chat_conversations').select(cols)
        .eq('client_id', clientId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false }).limit(LIMIT),
      supabase.from('chat_conversations').select(cols)
        .eq('client_id', clientId)
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString())
        .limit(LIMIT),
      supabase.from('chat_csat_responses').select('id, conversation_id, cod_agent, score, status, responded_at, feedback')
        .eq('client_id', clientId)
        .gte('sent_at', startDate.toISOString())
        .lte('sent_at', endDate.toISOString())
        .limit(LIMIT),
    ]);

    setConversations((cur ?? []) as ConversationRow[]);
    setPrevConversations((prev ?? []) as ConversationRow[]);
    setCsatRows((csat ?? []) as CsatRow[]);
    setLimitReached((cur?.length ?? 0) >= LIMIT);
    setLoading(false);
  }, [clientId, startDate.toISOString(), endDate.toISOString(), prevStart.toISOString(), prevEnd.toISOString()]);

  // ─── Live data (real-time) ────────────────────────────────────────
  const loadLive = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase.from('chat_conversations')
      .select('id, status, opened_at, priority, first_response_at')
      .eq('client_id', clientId)
      .in('status', ['pending', 'open']);
    const rows = (data ?? []) as { id: string; status: string; opened_at: string; first_response_at: string | null }[];
    const now = new Date();
    let atRisk = 0, breached = 0;
    rows.forEach(r => {
      if (!r.first_response_at && r.opened_at) {
        const mins = differenceInMinutes(now, parseISO(r.opened_at));
        if (mins > slaTarget) breached++;
        else if (mins > slaTarget * 0.8) atRisk++;
      }
    });
    setLiveData({
      pending: rows.filter(r => r.status === 'pending').length,
      open: rows.filter(r => r.status === 'open').length,
      slaAtRisk: atRisk,
      slaBreached: breached,
      lastRefresh: new Date(),
    });
  }, [clientId, slaTarget]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadQueues(); }, [loadQueues]);
  useEffect(() => {
    loadLive();
    const id = setInterval(loadLive, 60_000);
    return () => clearInterval(id);
  }, [loadLive]);

  // ─── Filters applied ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    return conversations.filter(c =>
      (queueFilter === 'all' || c.queue_id === queueFilter) &&
      (channelFilter === 'all' || c.channel === channelFilter) &&
      (agentFilter === 'all' || c.assigned_to === agentFilter || (agentFilter === '__unassigned' && !c.assigned_to)) &&
      (statusFilter === 'all' || c.status === statusFilter)
    );
  }, [conversations, queueFilter, channelFilter, agentFilter, statusFilter]);

  const filteredPrev = useMemo(() => {
    return prevConversations.filter(c =>
      (queueFilter === 'all' || c.queue_id === queueFilter) &&
      (channelFilter === 'all' || c.channel === channelFilter) &&
      (agentFilter === 'all' || c.assigned_to === agentFilter || (agentFilter === '__unassigned' && !c.assigned_to))
    );
  }, [prevConversations, queueFilter, channelFilter, agentFilter]);

  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    conversations.forEach(c => { if (c.assigned_to) set.add(c.assigned_to); });
    return Array.from(set).sort();
  }, [conversations]);

  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    conversations.forEach(c => set.add(c.channel));
    return Array.from(set).sort();
  }, [conversations]);

  // ─── KPIs ─────────────────────────────────────────────────────────
  const computeKpis = useCallback((rows: ConversationRow[]) => {
    const total = rows.length;
    const resolvedCount = rows.filter(c => c.status === 'resolved' || c.status === 'closed').length;
    const pending = rows.filter(c => c.status === 'pending').length;
    const open = rows.filter(c => c.status === 'open').length;

    const withResponse = rows.filter(c => c.first_response_at && c.opened_at);
    const avgFirstResponse = withResponse.length > 0
      ? Math.round(withResponse.reduce((s, c) => s + differenceInMinutes(parseISO(c.first_response_at!), parseISO(c.opened_at)), 0) / withResponse.length)
      : 0;

    const withResolution = rows.filter(c => (c.resolved_at || c.closed_at) && c.opened_at);
    const avgResolution = withResolution.length > 0
      ? Math.round(withResolution.reduce((s, c) => {
          const end = c.resolved_at || c.closed_at!;
          return s + differenceInMinutes(parseISO(end), parseISO(c.opened_at));
        }, 0) / withResolution.length)
      : 0;

    const withinSla = withResponse.filter(c =>
      differenceInMinutes(parseISO(c.first_response_at!), parseISO(c.opened_at)) <= slaTarget
    ).length;
    const slaPercent = withResponse.length > 0 ? Math.round((withinSla / withResponse.length) * 100) : 100;
    const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;

    // FCR: resolved with first response (no transfer proxy)
    const fcr = rows.filter(c => c.status === 'resolved' && c.first_response_at != null).length;
    const fcrRate = total > 0 ? Math.round((fcr / total) * 100) : 0;

    // Abandono: closed without any agent response
    const abandoned = rows.filter(c => c.status === 'closed' && c.first_response_at == null).length;
    const abandonRate = total > 0 ? Math.round((abandoned / total) * 100) : 0;

    return { total, resolved: resolvedCount, pending, open, avgFirstResponse, avgResolution, slaPercent, resolutionRate, fcrRate, abandonRate };
  }, [slaTarget]);

  const kpis = useMemo(() => computeKpis(filtered), [filtered, computeKpis]);
  const prevKpis = useMemo(() => computeKpis(filteredPrev), [filteredPrev, computeKpis]);

  // CSAT
  const csatStats = useMemo(() => {
    const convIds = new Set(filtered.map(c => c.id));
    const relevant = csatRows.filter(r => convIds.has(r.conversation_id) && r.status === 'responded' && r.score != null);
    if (relevant.length === 0) return { avg: 0, count: 0, sent: csatRows.filter(r => convIds.has(r.conversation_id)).length, byScore: [] as { score: number; count: number }[] };
    const avg = relevant.reduce((s, r) => s + r.score, 0) / relevant.length;
    const byScore = [1, 2, 3, 4, 5].map(score => ({ score, count: relevant.filter(r => r.score === score).length }));
    return { avg: Math.round(avg * 10) / 10, count: relevant.length, sent: csatRows.filter(r => convIds.has(r.conversation_id)).length, byScore };
  }, [csatRows, filtered]);

  // ─── Chart Data ───────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const days: Record<string, { date: string; opened: number; resolved: number }> = {};
    for (let i = 0; i < periodDays; i++) {
      const d = format(subDays(new Date(), periodDays - 1 - i), 'yyyy-MM-dd');
      days[d] = { date: d, opened: 0, resolved: 0 };
    }
    filtered.forEach(c => {
      const d = format(parseISO(c.created_at), 'yyyy-MM-dd');
      if (days[d]) days[d].opened++;
      const end = c.resolved_at || c.closed_at;
      if (end) { const ed = format(parseISO(end), 'yyyy-MM-dd'); if (days[ed]) days[ed].resolved++; }
    });
    return Object.values(days).map(d => ({ ...d, label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }) }));
  }, [filtered, periodDays]);

  const channelData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(c => { counts[c.channel] = (counts[c.channel] || 0) + 1; });
    return Object.entries(counts).map(([channel, value]) => ({
      name: CHANNEL_LABELS[channel] || channel, value, color: CHANNEL_COLORS[channel] || '#6b7280',
    }));
  }, [filtered]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return Object.entries(counts).map(([status, value]) => ({
      name: status === 'pending' ? 'Pendentes' : status === 'open' ? 'Abertas' : status === 'resolved' ? 'Resolvidas' : 'Encerradas',
      value, color: STATUS_COLORS[status] || '#6b7280',
    }));
  }, [filtered]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}h`, count: 0 }));
    filtered.forEach(c => { hours[parseISO(c.created_at).getHours()].count++; });
    return hours;
  }, [filtered]);

  // CSAT trend por semana
  const csatTrend = useMemo(() => {
    if (csatRows.length === 0) return [];
    const convIds = new Set(filtered.map(c => c.id));
    const relevant = csatRows.filter(r => convIds.has(r.conversation_id) && r.status === 'responded' && r.score != null && r.responded_at);
    const weekMap = new Map<string, { sum: number; count: number }>();
    relevant.forEach(r => {
      const weekStart = format(startOfWeek(parseISO(r.responded_at!), { locale: ptBR }), 'dd/MM', { locale: ptBR });
      const cur = weekMap.get(weekStart) || { sum: 0, count: 0 };
      weekMap.set(weekStart, { sum: cur.sum + r.score, count: cur.count + 1 });
    });
    return Array.from(weekMap.entries())
      .map(([week, { sum, count }]) => ({ week, avg: Math.round((sum / count) * 10) / 10, count }))
      .slice(-12);
  }, [csatRows, filtered]);

  // ─── Agent ranking ─────────────────────────────────────────────────
  const agentRanking = useMemo(() => {
    type R = { agent: string; total: number; resolved: number; firstResponseCount: number; firstResponseSum: number; resolutionCount: number; resolutionSum: number; csatAvg: number; csatCount: number; abandoned: number };
    const map = new Map<string, R>();
    filtered.forEach(c => {
      if (!c.assigned_to) return;
      const r = map.get(c.assigned_to) || { agent: c.assigned_to, total: 0, resolved: 0, firstResponseCount: 0, firstResponseSum: 0, resolutionCount: 0, resolutionSum: 0, csatAvg: 0, csatCount: 0, abandoned: 0 };
      r.total++;
      if (c.status === 'resolved' || c.status === 'closed') r.resolved++;
      if (c.status === 'closed' && !c.first_response_at) r.abandoned++;
      if (c.first_response_at && c.opened_at) {
        r.firstResponseCount++;
        r.firstResponseSum += differenceInMinutes(parseISO(c.first_response_at), parseISO(c.opened_at));
      }
      const end = c.resolved_at || c.closed_at;
      if (end && c.opened_at) {
        r.resolutionCount++;
        r.resolutionSum += differenceInMinutes(parseISO(end), parseISO(c.opened_at));
      }
      map.set(c.assigned_to, r);
    });
    const convAgent = new Map(filtered.map(c => [c.id, c.assigned_to] as const));
    csatRows.forEach(cs => {
      if (cs.status !== 'responded' || cs.score == null) return;
      const agent = convAgent.get(cs.conversation_id);
      if (!agent) return;
      const r = map.get(agent);
      if (r) { r.csatAvg += cs.score; r.csatCount++; }
    });
    const rows = Array.from(map.values()).map(r => ({
      agent: r.agent,
      total: r.total,
      resolved: r.resolved,
      avgFirst: r.firstResponseCount > 0 ? Math.round(r.firstResponseSum / r.firstResponseCount) : 0,
      avgRes: r.resolutionCount > 0 ? Math.round(r.resolutionSum / r.resolutionCount) : 0,
      csatAvg: r.csatCount > 0 ? Math.round((r.csatAvg / r.csatCount) * 10) / 10 : 0,
      csatCount: r.csatCount,
      resolutionRate: r.total > 0 ? Math.round((r.resolved / r.total) * 100) : 0,
      abandonRate: r.total > 0 ? Math.round((r.abandoned / r.total) * 100) : 0,
      fcrRate: r.total > 0 ? Math.round((filtered.filter(c => c.assigned_to === r.agent && c.status === 'resolved' && c.first_response_at).length / r.total) * 100) : 0,
    }));
    return rows.sort((a, b) => {
      const av = a[agentSortField] as number;
      const bv = b[agentSortField] as number;
      return agentSortDir === 'desc' ? bv - av : av - bv;
    }).slice(0, 20);
  }, [filtered, csatRows, agentSortField, agentSortDir]);

  // ─── Queue stats ──────────────────────────────────────────────────
  const queueStats = useMemo(() => {
    const map = new Map<string, { total: number; firstResponseSum: number; firstResponseCount: number; withinSla: number; csatSum: number; csatCount: number }>();
    filtered.forEach(c => {
      const qid = c.queue_id || '__none';
      const r = map.get(qid) || { total: 0, firstResponseSum: 0, firstResponseCount: 0, withinSla: 0, csatSum: 0, csatCount: 0 };
      r.total++;
      if (c.first_response_at && c.opened_at) {
        const mins = differenceInMinutes(parseISO(c.first_response_at), parseISO(c.opened_at));
        r.firstResponseSum += mins;
        r.firstResponseCount++;
        if (mins <= slaTarget) r.withinSla++;
      }
      map.set(qid, r);
    });
    const convIds = new Set(filtered.map(c => c.id));
    const convQueue = new Map(filtered.map(c => [c.id, c.queue_id || '__none'] as const));
    csatRows.forEach(cs => {
      if (cs.status !== 'responded' || cs.score == null) return;
      const qid = convQueue.get(cs.conversation_id);
      if (!qid) return;
      const r = map.get(qid);
      if (r) { r.csatSum += cs.score; r.csatCount++; }
    });
    return Array.from(map.entries()).map(([qid, r]) => ({
      queueId: qid,
      name: qid === '__none' ? '(sem fila)' : (queues.find(q => q.id === qid)?.name ?? qid.slice(0, 8)),
      total: r.total,
      avgTme: r.firstResponseCount > 0 ? Math.round(r.firstResponseSum / r.firstResponseCount) : 0,
      slaPercent: r.firstResponseCount > 0 ? Math.round((r.withinSla / r.firstResponseCount) * 100) : 100,
      csatAvg: r.csatCount > 0 ? Math.round((r.csatSum / r.csatCount) * 10) / 10 : 0,
    })).sort((a, b) => b.total - a.total);
  }, [filtered, csatRows, queues, slaTarget]);

  const formatMinutes = (min: number) => {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60); const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const delta = (cur: number, prev: number): { pct: number; trend: 'up' | 'down' | 'flat' } => {
    if (prev === 0) return { pct: cur > 0 ? 100 : 0, trend: cur > 0 ? 'up' : 'flat' };
    const diff = ((cur - prev) / prev) * 100;
    return { pct: Math.round(Math.abs(diff)), trend: diff > 1 ? 'up' : diff < -1 ? 'down' : 'flat' };
  };

  const toggleSort = (field: SortField) => {
    if (agentSortField === field) setAgentSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setAgentSortField(field); setAgentSortDir('desc'); }
  };

  // ─── Exports ──────────────────────────────────────────────────────
  const exportCsv = () => {
    if (filtered.length === 0) return;
    const rows = filtered.map(c => ({
      protocol: c.protocol, channel: c.channel, status: c.status, priority: c.priority,
      assigned_to: c.assigned_to ?? '', opened_at: c.opened_at,
      first_response_at: c.first_response_at ?? '', resolved_at: c.resolved_at ?? '', closed_at: c.closed_at ?? '',
      first_response_min: c.first_response_at ? differenceInMinutes(parseISO(c.first_response_at), parseISO(c.opened_at)) : '',
      resolution_min: (c.resolved_at || c.closed_at) ? differenceInMinutes(parseISO((c.resolved_at || c.closed_at)!), parseISO(c.opened_at)) : '',
    }));
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? '')).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `chat-metrics-${period}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    a.click();
  };

  const exportPdf = () => {
    const periodLabel = `${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`;
    const filtersList: { label: string; value: string }[] = [];
    if (queueFilter !== 'all') filtersList.push({ label: 'Fila', value: queues.find(q => q.id === queueFilter)?.name ?? queueFilter });
    if (channelFilter !== 'all') filtersList.push({ label: 'Canal', value: CHANNEL_LABELS[channelFilter] ?? channelFilter });
    if (agentFilter !== 'all') filtersList.push({ label: 'Atendente', value: agentFilter === '__unassigned' ? 'Sem atendente' : agentFilter });
    const doc = generateChatMetricsPdf({
      title: 'Relatório de Métricas — Chat', periodLabel, filters: filtersList,
      kpis: [
        { label: 'Total de conversas', value: kpis.total },
        { label: 'Taxa de resolução', value: `${kpis.resolutionRate}%` },
        { label: 'TME (1ª resposta)', value: formatMinutes(kpis.avgFirstResponse) },
        { label: 'TMA (resolução)', value: formatMinutes(kpis.avgResolution) },
        { label: `SLA (≤${slaTarget}min)`, value: `${kpis.slaPercent}%` },
        { label: 'FCR', value: `${kpis.fcrRate}%` },
        { label: 'Abandono', value: `${kpis.abandonRate}%` },
      ],
      channelDistribution: channelData.map(c => ({ name: c.name, value: c.value })),
      statusDistribution: statusData.map(s => ({ name: s.name, value: s.value })),
      hourlyVolume: hourlyData, dailyVolume: dailyData,
      agentRanking: agentRanking.map(r => ({ agent: r.agent, total: r.total, resolved: r.resolved, resolutionRate: r.resolutionRate, avgFirst: r.avgFirst, avgRes: r.avgRes, csatAvg: r.csatAvg, csatCount: r.csatCount })),
      csat: csatStats.sent > 0 ? { avg: csatStats.avg, count: csatStats.count, sent: csatStats.sent } : undefined,
    });
    doc.save(`chat-metrics-${period}-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6 w-full">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Métricas de Atendimento</h2>
            <p className="text-muted-foreground text-sm">Dashboard de performance do chat omnichannel</p>
          </div>
        </div>
        <TooltipProvider delayDuration={400}>
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="14d">Últimos 14 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </TooltipTrigger>
            <TooltipContent>Período de análise — todos os KPIs e gráficos refletem o intervalo selecionado</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Select value={queueFilter} onValueChange={setQueueFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Fila" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as filas</SelectItem>
                  {queues.map(q => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </TooltipTrigger>
            <TooltipContent>Filtra por fila de atendimento — cada fila representa um canal ou departamento específico</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Canal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos canais</SelectItem>
                  {channelOptions.map(ch => <SelectItem key={ch} value={ch}>{CHANNEL_LABELS[ch] || ch}</SelectItem>)}
                </SelectContent>
              </Select>
            </TooltipTrigger>
            <TooltipContent>Filtra por canal de origem da conversa (WhatsApp, WebChat, Instagram…)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Atendente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos atendentes</SelectItem>
                  <SelectItem value="__unassigned">Sem atendente</SelectItem>
                  {agentOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </TooltipTrigger>
            <TooltipContent>Filtra por atendente responsável — "Sem atendente" mostra conversas não atribuídas</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="open">Em atendimento</SelectItem>
                  <SelectItem value="resolved">Resolvidas</SelectItem>
                  <SelectItem value="closed">Encerradas</SelectItem>
                </SelectContent>
              </Select>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-semibold mb-1">Filtro por status:</p>
              <ul className="space-y-0.5 text-xs">
                <li><span className="font-medium">Pendentes</span> — aguardando 1º atendimento</li>
                <li><span className="font-medium">Em atendimento</span> — agente em conversa ativa</li>
                <li><span className="font-medium">Resolvidas</span> — finalizadas com resolução confirmada</li>
                <li><span className="font-medium">Encerradas</span> — fechadas sem resolução (abandono ou timeout)</li>
              </ul>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            </TooltipTrigger>
            <TooltipContent>Exporta todas as conversas filtradas com tempos de resposta e resolução</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={exportPdf} disabled={filtered.length === 0}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
            </TooltipTrigger>
            <TooltipContent>Gera relatório em PDF com KPIs, gráficos e ranking de atendentes</TooltipContent>
          </Tooltip>
        </div>
        </TooltipProvider>
      </div>

      {/* ── Banner de limite ─────────────────────────────────────────── */}
      {limitReached && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Limite de {LIMIT.toLocaleString()} registros atingido. Reduza o período para maior precisão.
        </div>
      )}

      {/* ── Seção AGORA (tempo real) ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Aguardando', value: liveData?.pending ?? '—',
            icon: <Clock className="h-4 w-4" />, color: 'text-yellow-500',
            alert: (liveData?.pending ?? 0) > 5, desc: 'conversas pendentes',
          },
          {
            label: 'Em atendimento', value: liveData?.open ?? '—',
            icon: <MessageCircle className="h-4 w-4" />, color: 'text-blue-500',
            alert: false, desc: 'conversas abertas',
          },
          {
            label: 'SLA em risco', value: liveData?.slaAtRisk ?? '—',
            icon: <AlertTriangle className="h-4 w-4" />, color: 'text-orange-500',
            alert: (liveData?.slaAtRisk ?? 0) > 0, desc: `>80% do alvo (${slaTarget}min)`,
          },
          {
            label: 'SLA violado', value: liveData?.slaBreached ?? '—',
            icon: <XCircle className="h-4 w-4" />, color: 'text-red-500',
            alert: (liveData?.slaBreached ?? 0) > 0, desc: `sem 1ª resposta acima de ${slaTarget}min`,
          },
        ].map((item) => (
          <Card key={item.label} className={cn('border', item.alert && (item.color === 'text-red-500' ? 'border-red-500/40 bg-red-500/5' : 'border-orange-500/40 bg-orange-500/5'))}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={item.color}>{item.icon}</div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold leading-tight">{item.value}</p>
                <p className="text-[10px] text-muted-foreground truncate">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {liveData && (
          <div className="col-span-2 md:col-span-4 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Atualizado às {format(liveData.lastRefresh, 'HH:mm:ss')} · atualiza a cada 60s
          </div>
        )}
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={<MessageCircle className="h-5 w-5" />} label="Total de Conversas" value={kpis.total} color="text-primary" delta={delta(kpis.total, prevKpis.total)} />
        <KPICard icon={<Timer className="h-5 w-5" />} label="TME (1ª Resposta)" value={formatMinutes(kpis.avgFirstResponse)} color="text-blue-500" delta={delta(prevKpis.avgFirstResponse, kpis.avgFirstResponse)} trafficLight={{ val: kpis.avgFirstResponse, greenBelow: slaTarget, redAbove: slaTarget * 2 }} />
        <KPICard icon={<Zap className="h-5 w-5" />} label={`SLA (≤${slaTarget}min)`} value={`${kpis.slaPercent}%`} color={kpis.slaPercent >= 80 ? 'text-green-500' : kpis.slaPercent >= 50 ? 'text-yellow-500' : 'text-red-500'} delta={delta(kpis.slaPercent, prevKpis.slaPercent)} />
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} label="Taxa de Resolução" value={`${kpis.resolutionRate}%`} color="text-green-500" delta={delta(kpis.resolutionRate, prevKpis.resolutionRate)} />
        <KPICard icon={<Activity className="h-5 w-5" />} label="TMA (Resolução)" value={formatMinutes(kpis.avgResolution)} color="text-purple-500" delta={delta(prevKpis.avgResolution, kpis.avgResolution)} trafficLight={{ val: kpis.avgResolution, greenBelow: 60, redAbove: 240 }} />
        <KPICard icon={<Star className="h-5 w-5" />} label={`CSAT (${csatStats.count}/${csatStats.sent})`} value={csatStats.count > 0 ? `${csatStats.avg} ★` : '—'} color="text-amber-500" />
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} label="FCR (1º contato)" value={`${kpis.fcrRate}%`} color={kpis.fcrRate >= 70 ? 'text-green-500' : kpis.fcrRate >= 40 ? 'text-yellow-500' : 'text-red-500'} delta={delta(kpis.fcrRate, prevKpis.fcrRate)} />
        <KPICard icon={<PhoneOff className="h-5 w-5" />} label="Taxa de Abandono" value={`${kpis.abandonRate}%`} color={kpis.abandonRate === 0 ? 'text-green-500' : kpis.abandonRate <= 10 ? 'text-yellow-500' : 'text-red-500'} alert={kpis.abandonRate > 10} delta={delta(prevKpis.abandonRate, kpis.abandonRate)} />
      </div>

      {/* ── Gráficos ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Volume Diário</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
                <Area type="monotone" dataKey="opened" name="Abertas" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                <Area type="monotone" dataKey="resolved" name="Resolvidas" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conversas por Canal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={channelData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {channelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Distribuição por Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={statusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="value" name="Conversas" radius={[0, 4, 4, 0]}>
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Horário de Pico</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="count" name="Conversas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Heatmap ───────────────────────────────────────────────────── */}
      <ChatHeatmap conversations={filtered} />

      {/* ── CSAT Distribuição + Tendência ─────────────────────────────── */}
      {csatStats.count > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Distribuição CSAT</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3">
                {csatStats.byScore.map(s => {
                  const pct = csatStats.count > 0 ? Math.round((s.count / csatStats.count) * 100) : 0;
                  return (
                    <div key={s.score} className="text-center space-y-1">
                      <div className="flex items-center justify-center gap-0.5 text-amber-500">
                        {Array.from({ length: s.score }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
                      </div>
                      <div className="h-24 bg-muted rounded relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 right-0 bg-amber-500" style={{ height: `${pct}%` }} />
                      </div>
                      <div className="text-xs font-semibold">{s.count}</div>
                      <div className="text-[10px] text-muted-foreground">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {csatTrend.length >= 2 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-amber-500" /> Tendência CSAT por Semana</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={csatTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                      formatter={(v: number) => [`${v} ★`, 'CSAT médio']} />
                    <Line type="monotone" dataKey="avg" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Ranking de Atendentes ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Ranking de Atendentes</CardTitle>
        </CardHeader>
        <CardContent>
          {agentRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum atendente com conversas atribuídas neste período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Atendente</th>
                    <SortTh field="total" label="Total" current={agentSortField} dir={agentSortDir} onSort={toggleSort} />
                    <SortTh field="resolved" label="Resolvidas" current={agentSortField} dir={agentSortDir} onSort={toggleSort} />
                    <SortTh field="resolutionRate" label="Tx. Resol." current={agentSortField} dir={agentSortDir} onSort={toggleSort} />
                    <SortTh field="avgFirst" label="TME" current={agentSortField} dir={agentSortDir} onSort={toggleSort} />
                    <SortTh field="avgRes" label="TMA" current={agentSortField} dir={agentSortDir} onSort={toggleSort} />
                    <SortTh field="csatAvg" label="CSAT" current={agentSortField} dir={agentSortDir} onSort={toggleSort} />
                    <SortTh field="abandonRate" label="Abandono" current={agentSortField} dir={agentSortDir} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {agentRanking.map((r, idx) => (
                    <tr key={r.agent} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{r.agent.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                          <span className="font-medium">{r.agent}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-right">{r.total}</td>
                      <td className="py-2 pr-2 text-right">{r.resolved}</td>
                      <td className="py-2 pr-2 text-right">
                        <Badge variant={r.resolutionRate >= 80 ? 'default' : r.resolutionRate >= 50 ? 'secondary' : 'destructive'} className="font-mono">{r.resolutionRate}%</Badge>
                      </td>
                      <td className="py-2 pr-2 text-right font-mono">{formatMinutes(r.avgFirst)}</td>
                      <td className="py-2 pr-2 text-right font-mono">{formatMinutes(r.avgRes)}</td>
                      <td className="py-2 pr-2 text-right font-mono">{r.csatCount > 0 ? `${r.csatAvg} ★` : '—'}</td>
                      <td className="py-2 pr-2 text-right">
                        <span className={cn('font-mono text-xs', r.abandonRate === 0 ? 'text-green-600' : r.abandonRate <= 10 ? 'text-yellow-600' : 'text-red-600')}>{r.abandonRate}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Performance por Fila ──────────────────────────────────────── */}
      {queueStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> Performance por Fila</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4">Fila</th>
                    <th className="py-2 pr-4 text-right">Volume</th>
                    <th className="py-2 pr-4 text-right">TME médio</th>
                    <th className="py-2 pr-4 text-right">SLA %</th>
                    <th className="py-2 pr-4 text-right">CSAT</th>
                  </tr>
                </thead>
                <tbody>
                  {queueStats.map(q => (
                    <tr key={q.queueId} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 pr-4 font-medium">{q.name}</td>
                      <td className="py-2 pr-4 text-right">{q.total}</td>
                      <td className="py-2 pr-4 text-right font-mono">{formatMinutes(q.avgTme)}</td>
                      <td className="py-2 pr-4 text-right">
                        <Badge variant={q.slaPercent >= 80 ? 'default' : q.slaPercent >= 50 ? 'secondary' : 'destructive'} className="font-mono">{q.slaPercent}%</Badge>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono">{q.csatAvg > 0 ? `${q.csatAvg} ★` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function KPICard({ icon, label, value, color, alert, delta, trafficLight }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
  alert?: boolean; delta?: { pct: number; trend: 'up' | 'down' | 'flat' };
  trafficLight?: { val: number; greenBelow: number; redAbove: number };
}) {
  const TrendIcon = delta?.trend === 'up' ? TrendingUp : delta?.trend === 'down' ? TrendingDown : Minus;
  const trendColor = delta?.trend === 'up' ? 'text-green-500' : delta?.trend === 'down' ? 'text-red-500' : 'text-muted-foreground';
  const tlColor = trafficLight
    ? trafficLight.val <= trafficLight.greenBelow ? 'text-green-500'
      : trafficLight.val <= trafficLight.redAbove ? 'text-yellow-500' : 'text-red-500'
    : color;

  return (
    <Card className={alert ? 'border-yellow-500/50 bg-yellow-500/5' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(tlColor || color, 'shrink-0')}>{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <div className="flex items-baseline gap-1.5">
              <p className={cn('text-xl font-bold', tlColor || color)}>{value}</p>
              {delta && delta.pct > 0 && (
                <span className={`text-[10px] flex items-center gap-0.5 ${trendColor}`}>
                  <TrendIcon className="h-3 w-3" />{delta.pct}%
                </span>
              )}
            </div>
          </div>
          {alert && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
        </div>
      </CardContent>
    </Card>
  );
}

function SortTh({ field, label, current, dir, onSort }: { field: SortField; label: string; current: SortField; dir: SortDir; onSort: (f: SortField) => void }) {
  const active = current === field;
  return (
    <th className="py-2 pr-2 text-right cursor-pointer select-none hover:text-foreground" onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-0.5 justify-end">
        {label}
        {active ? (dir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />) : <Minus className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  );
}
