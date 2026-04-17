import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import {
  Clock, MessageCircle, CheckCircle2, Users, Timer,
  ArrowLeft, Zap, AlertTriangle, BarChart3, Activity, Star, Download, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay, differenceInMinutes, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatHeatmap } from '@/components/chat/analytics/ChatHeatmap';

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

type Period = '7d' | '14d' | '30d' | '90d';

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

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [prevConversations, setPrevConversations] = useState<ConversationRow[]>([]);
  const [csatRows, setCsatRows] = useState<CsatRow[]>([]);
  const [queues, setQueues] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<Period>('30d');
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const periodDays = period === '7d' ? 7 : period === '14d' ? 14 : period === '30d' ? 30 : 90;
  const startDate = startOfDay(subDays(new Date(), periodDays));
  const endDate = endOfDay(new Date());
  const prevStart = startOfDay(subDays(startDate, periodDays));
  const prevEnd = endOfDay(subDays(endDate, periodDays));

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period]);
  useEffect(() => { loadQueues(); }, []);

  const loadQueues = async () => {
    const { data } = await supabase.from('queues').select('id, name').order('name');
    setQueues((data ?? []) as QueueRow[]);
  };

  const loadAll = async () => {
    setLoading(true);
    const cols = 'id, status, channel, assigned_to, opened_at, first_response_at, closed_at, resolved_at, created_at, priority, department, contact_id, queue_id, protocol';

    const [{ data: cur }, { data: prev }, { data: csat }] = await Promise.all([
      supabase.from('chat_conversations').select(cols)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false }).limit(2000),
      supabase.from('chat_conversations').select(cols)
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString())
        .limit(2000),
      supabase.from('chat_csat_responses').select('id, conversation_id, cod_agent, score, status, responded_at, feedback')
        .gte('sent_at', startDate.toISOString())
        .lte('sent_at', endDate.toISOString())
        .limit(2000),
    ]);

    setConversations((cur ?? []) as ConversationRow[]);
    setPrevConversations((prev ?? []) as ConversationRow[]);
    setCsatRows((csat ?? []) as CsatRow[]);
    setLoading(false);
  };

  // ─── Filters applied ────────────────────────────────────────────
  const filtered = useMemo(() => {
    return conversations.filter(c =>
      (queueFilter === 'all' || c.queue_id === queueFilter) &&
      (channelFilter === 'all' || c.channel === channelFilter) &&
      (agentFilter === 'all' || c.assigned_to === agentFilter || (agentFilter === '__unassigned' && !c.assigned_to))
    );
  }, [conversations, queueFilter, channelFilter, agentFilter]);

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

  // ─── KPIs ──────────────────────────────────────────────────────
  const computeKpis = (rows: ConversationRow[]) => {
    const total = rows.length;
    const resolved = rows.filter(c => c.status === 'resolved' || c.status === 'closed').length;
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

    const slaTarget = 15;
    const withinSla = withResponse.filter(c =>
      differenceInMinutes(parseISO(c.first_response_at!), parseISO(c.opened_at)) <= slaTarget
    ).length;
    const slaPercent = withResponse.length > 0 ? Math.round((withinSla / withResponse.length) * 100) : 100;

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const uniqueContacts = new Set(rows.map(c => c.contact_id)).size;

    return { total, resolved, pending, open, avgFirstResponse, avgResolution, slaPercent, resolutionRate, uniqueContacts };
  };

  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const prevKpis = useMemo(() => computeKpis(filteredPrev), [filteredPrev]);

  // CSAT for filtered conversations
  const csatStats = useMemo(() => {
    const convIds = new Set(filtered.map(c => c.id));
    const relevant = csatRows.filter(r => convIds.has(r.conversation_id) && r.status === 'responded' && r.score != null);
    if (relevant.length === 0) return { avg: 0, count: 0, sent: csatRows.filter(r => convIds.has(r.conversation_id)).length, byScore: [] as { score: number; count: number }[] };
    const avg = relevant.reduce((s, r) => s + r.score, 0) / relevant.length;
    const byScore = [1, 2, 3, 4, 5].map(score => ({ score, count: relevant.filter(r => r.score === score).length }));
    return { avg: Math.round(avg * 10) / 10, count: relevant.length, sent: csatRows.filter(r => convIds.has(r.conversation_id)).length, byScore };
  }, [csatRows, filtered]);

  // ─── Chart Data ────────────────────────────────────────────────
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
      if (end) {
        const ed = format(parseISO(end), 'yyyy-MM-dd');
        if (days[ed]) days[ed].resolved++;
      }
    });
    return Object.values(days).map(d => ({
      ...d,
      label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
    }));
  }, [filtered, periodDays]);

  const channelData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(c => { counts[c.channel] = (counts[c.channel] || 0) + 1; });
    return Object.entries(counts).map(([channel, value]) => ({
      name: CHANNEL_LABELS[channel] || channel,
      value,
      color: CHANNEL_COLORS[channel] || '#6b7280',
    }));
  }, [filtered]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return Object.entries(counts).map(([status, value]) => ({
      name: status === 'pending' ? 'Pendentes' : status === 'open' ? 'Abertas' : status === 'resolved' ? 'Resolvidas' : 'Encerradas',
      value,
      color: STATUS_COLORS[status] || '#6b7280',
    }));
  }, [filtered]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}h`, count: 0 }));
    filtered.forEach(c => { hours[parseISO(c.created_at).getHours()].count++; });
    return hours;
  }, [filtered]);

  // Ranking de atendentes
  const agentRanking = useMemo(() => {
    type R = { agent: string; total: number; resolved: number; avgFirst: number; avgRes: number; csatAvg: number; csatCount: number };
    const map = new Map<string, R>();
    filtered.forEach(c => {
      if (!c.assigned_to) return;
      const r = map.get(c.assigned_to) || { agent: c.assigned_to, total: 0, resolved: 0, avgFirst: 0, avgRes: 0, csatAvg: 0, csatCount: 0 };
      r.total++;
      if (c.status === 'resolved' || c.status === 'closed') r.resolved++;
      if (c.first_response_at) r.avgFirst += differenceInMinutes(parseISO(c.first_response_at), parseISO(c.opened_at));
      const end = c.resolved_at || c.closed_at;
      if (end) r.avgRes += differenceInMinutes(parseISO(end), parseISO(c.opened_at));
      map.set(c.assigned_to, r);
    });
    // Attach CSAT
    const convAgent = new Map(filtered.map(c => [c.id, c.assigned_to] as const));
    csatRows.forEach(cs => {
      if (cs.status !== 'responded' || cs.score == null) return;
      const agent = convAgent.get(cs.conversation_id);
      if (!agent) return;
      const r = map.get(agent);
      if (r) { r.csatAvg += cs.score; r.csatCount++; }
    });
    return Array.from(map.values())
      .map(r => ({
        ...r,
        avgFirst: r.total > 0 ? Math.round(r.avgFirst / Math.max(1, filtered.filter(c => c.assigned_to === r.agent && c.first_response_at).length)) : 0,
        avgRes: r.total > 0 ? Math.round(r.avgRes / Math.max(1, filtered.filter(c => c.assigned_to === r.agent && (c.resolved_at || c.closed_at)).length)) : 0,
        csatAvg: r.csatCount > 0 ? Math.round((r.csatAvg / r.csatCount) * 10) / 10 : 0,
        resolutionRate: r.total > 0 ? Math.round((r.resolved / r.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [filtered, csatRows]);

  const formatMinutes = (min: number) => {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  // ─── Compare deltas ────────────────────────────────────────────
  const delta = (cur: number, prev: number): { pct: number; trend: 'up' | 'down' | 'flat' } => {
    if (prev === 0) return { pct: cur > 0 ? 100 : 0, trend: cur > 0 ? 'up' : 'flat' };
    const diff = ((cur - prev) / prev) * 100;
    return { pct: Math.round(Math.abs(diff)), trend: diff > 1 ? 'up' : diff < -1 ? 'down' : 'flat' };
  };

  // ─── CSV export ────────────────────────────────────────────────
  const exportCsv = () => {
    const rows = filtered.map(c => ({
      protocol: c.protocol,
      channel: c.channel,
      status: c.status,
      priority: c.priority,
      assigned_to: c.assigned_to ?? '',
      opened_at: c.opened_at,
      first_response_at: c.first_response_at ?? '',
      resolved_at: c.resolved_at ?? '',
      closed_at: c.closed_at ?? '',
      first_response_min: c.first_response_at ? differenceInMinutes(parseISO(c.first_response_at), parseISO(c.opened_at)) : '',
      resolution_min: (c.resolved_at || c.closed_at) ? differenceInMinutes(parseISO((c.resolved_at || c.closed_at)!), parseISO(c.opened_at)) : '',
    }));
    const headers = Object.keys(rows[0] ?? { protocol: '' });
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? '')).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-metrics-${period}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Métricas de Atendimento</h2>
            <p className="text-muted-foreground text-sm">Dashboard de performance do chat omnichannel</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="14d">Últimos 14 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={queueFilter} onValueChange={setQueueFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Fila" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as filas</SelectItem>
              {queues.map(q => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos canais</SelectItem>
              {channelOptions.map(ch => <SelectItem key={ch} value={ch}>{CHANNEL_LABELS[ch] || ch}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Atendente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos atendentes</SelectItem>
              <SelectItem value="__unassigned">Sem atendente</SelectItem>
              {agentOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards with deltas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={<MessageCircle className="h-5 w-5" />} label="Total de Conversas" value={kpis.total} color="text-primary" delta={delta(kpis.total, prevKpis.total)} />
        <KPICard icon={<Clock className="h-5 w-5" />} label="Pendentes Agora" value={kpis.pending} color="text-yellow-500" alert={kpis.pending > 10} />
        <KPICard icon={<Timer className="h-5 w-5" />} label="TME (1ª Resposta)" value={formatMinutes(kpis.avgFirstResponse)} color="text-blue-500" delta={delta(prevKpis.avgFirstResponse, kpis.avgFirstResponse)} />
        <KPICard icon={<Zap className="h-5 w-5" />} label="SLA (≤15min)" value={`${kpis.slaPercent}%`} color={kpis.slaPercent >= 80 ? 'text-green-500' : kpis.slaPercent >= 50 ? 'text-yellow-500' : 'text-red-500'} delta={delta(kpis.slaPercent, prevKpis.slaPercent)} />
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} label="Taxa de Resolução" value={`${kpis.resolutionRate}%`} color="text-green-500" delta={delta(kpis.resolutionRate, prevKpis.resolutionRate)} />
        <KPICard icon={<Activity className="h-5 w-5" />} label="Em Atendimento" value={kpis.open} color="text-blue-500" />
        <KPICard icon={<Timer className="h-5 w-5" />} label="TMA (Resolução)" value={formatMinutes(kpis.avgResolution)} color="text-purple-500" delta={delta(prevKpis.avgResolution, kpis.avgResolution)} />
        <KPICard icon={<Star className="h-5 w-5" />} label={`CSAT (${csatStats.count}/${csatStats.sent})`} value={csatStats.count > 0 ? `${csatStats.avg} ★` : '—'} color="text-amber-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Volume Diário</CardTitle>
          </CardHeader>
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

      {/* Heatmap dia × hora */}
      <ChatHeatmap conversations={filtered} />

      {csatStats.count > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Distribuição CSAT</CardTitle>
          </CardHeader>
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
      )}

      {/* Agent ranking */}
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
                    <th className="py-2 pr-2 text-right">Total</th>
                    <th className="py-2 pr-2 text-right">Resolvidas</th>
                    <th className="py-2 pr-2 text-right">Tx. Resol.</th>
                    <th className="py-2 pr-2 text-right">TME</th>
                    <th className="py-2 pr-2 text-right">TMA</th>
                    <th className="py-2 pr-2 text-right">CSAT</th>
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
                        <Badge variant={r.resolutionRate >= 80 ? 'default' : r.resolutionRate >= 50 ? 'secondary' : 'destructive'} className="font-mono">
                          {r.resolutionRate}%
                        </Badge>
                      </td>
                      <td className="py-2 pr-2 text-right font-mono">{formatMinutes(r.avgFirst)}</td>
                      <td className="py-2 pr-2 text-right font-mono">{formatMinutes(r.avgRes)}</td>
                      <td className="py-2 pr-2 text-right font-mono">{r.csatCount > 0 ? `${r.csatAvg} ★` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── KPI Card Component ──────────────────────────────────────────
function KPICard({ icon, label, value, color, alert, delta }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  alert?: boolean;
  delta?: { pct: number; trend: 'up' | 'down' | 'flat' };
}) {
  const TrendIcon = delta?.trend === 'up' ? TrendingUp : delta?.trend === 'down' ? TrendingDown : Minus;
  const trendColor = delta?.trend === 'up' ? 'text-green-500' : delta?.trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <Card className={alert ? 'border-yellow-500/50 bg-yellow-500/5' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`${color} shrink-0`}>{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-xl font-bold text-foreground">{value}</p>
              {delta && delta.pct > 0 && (
                <span className={`text-[10px] flex items-center gap-0.5 ${trendColor}`}>
                  <TrendIcon className="h-3 w-3" />
                  {delta.pct}%
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
