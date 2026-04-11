import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';
import {
  Clock, MessageCircle, CheckCircle2, Users, TrendingUp, Timer,
  ArrowLeft, Zap, AlertTriangle, BarChart3, Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay, differenceInMinutes, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
}

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
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');

  const periodDays = period === '7d' ? 7 : period === '14d' ? 14 : period === '30d' ? 30 : 90;
  const startDate = startOfDay(subDays(new Date(), periodDays));
  const endDate = endOfDay(new Date());

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, status, channel, assigned_to, opened_at, first_response_at, closed_at, resolved_at, created_at, priority, department, contact_id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    if (!error && data) {
      setConversations(data as ConversationRow[]);
    }
    setLoading(false);
  };

  // ─── KPIs ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = conversations.length;
    const resolved = conversations.filter(c => c.status === 'resolved' || c.status === 'closed').length;
    const pending = conversations.filter(c => c.status === 'pending').length;
    const open = conversations.filter(c => c.status === 'open').length;

    // Average first response time (minutes)
    const withResponse = conversations.filter(c => c.first_response_at && c.opened_at);
    const avgFirstResponse = withResponse.length > 0
      ? Math.round(withResponse.reduce((sum, c) => sum + differenceInMinutes(parseISO(c.first_response_at!), parseISO(c.opened_at)), 0) / withResponse.length)
      : 0;

    // Average resolution time (minutes)
    const withResolution = conversations.filter(c => (c.resolved_at || c.closed_at) && c.opened_at);
    const avgResolution = withResolution.length > 0
      ? Math.round(withResolution.reduce((sum, c) => {
          const end = c.resolved_at || c.closed_at!;
          return sum + differenceInMinutes(parseISO(end), parseISO(c.opened_at));
        }, 0) / withResolution.length)
      : 0;

    // SLA: conversations responded within 15 minutes
    const slaTarget = 15; // minutes
    const withinSla = withResponse.filter(c => 
      differenceInMinutes(parseISO(c.first_response_at!), parseISO(c.opened_at)) <= slaTarget
    ).length;
    const slaPercent = withResponse.length > 0 ? Math.round((withinSla / withResponse.length) * 100) : 100;

    // Unique contacts
    const uniqueContacts = new Set(conversations.map(c => c.contact_id)).size;

    return { total, resolved, pending, open, avgFirstResponse, avgResolution, slaPercent, uniqueContacts };
  }, [conversations]);

  // ─── Chart Data ────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const days: Record<string, { date: string; opened: number; resolved: number; closed: number }> = {};
    for (let i = 0; i < periodDays; i++) {
      const d = format(subDays(new Date(), periodDays - 1 - i), 'yyyy-MM-dd');
      days[d] = { date: d, opened: 0, resolved: 0, closed: 0 };
    }
    conversations.forEach(c => {
      const d = format(parseISO(c.created_at), 'yyyy-MM-dd');
      if (days[d]) days[d].opened++;
      if (c.resolved_at) {
        const rd = format(parseISO(c.resolved_at), 'yyyy-MM-dd');
        if (days[rd]) days[rd].resolved++;
      }
      if (c.closed_at) {
        const cd = format(parseISO(c.closed_at), 'yyyy-MM-dd');
        if (days[cd]) days[cd].closed++;
      }
    });
    return Object.values(days).map(d => ({
      ...d,
      label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
    }));
  }, [conversations, periodDays]);

  const channelData = useMemo(() => {
    const counts: Record<string, number> = {};
    conversations.forEach(c => {
      counts[c.channel] = (counts[c.channel] || 0) + 1;
    });
    return Object.entries(counts).map(([channel, value]) => ({
      name: CHANNEL_LABELS[channel] || channel,
      value,
      color: CHANNEL_COLORS[channel] || '#6b7280',
    }));
  }, [conversations]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    conversations.forEach(c => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, value]) => ({
      name: status === 'pending' ? 'Pendentes' : status === 'open' ? 'Abertas' : status === 'resolved' ? 'Resolvidas' : 'Encerradas',
      value,
      color: STATUS_COLORS[status] || '#6b7280',
    }));
  }, [conversations]);

  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    conversations.forEach(c => {
      counts[c.priority || 'normal'] = (counts[c.priority || 'normal'] || 0) + 1;
    });
    const labels: Record<string, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };
    const colors: Record<string, string> = { low: '#6b7280', normal: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' };
    return Object.entries(counts).map(([p, value]) => ({
      name: labels[p] || p,
      value,
      color: colors[p] || '#6b7280',
    }));
  }, [conversations]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}h`, count: 0 }));
    conversations.forEach(c => {
      const h = parseISO(c.created_at).getHours();
      hours[h].count++;
    });
    return hours;
  }, [conversations]);

  const formatMinutes = (min: number) => {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Métricas de Atendimento</h2>
            <p className="text-muted-foreground text-sm">Dashboard de performance do chat omnichannel</p>
          </div>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="14d">Últimos 14 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          icon={<MessageCircle className="h-5 w-5" />}
          label="Total de Conversas"
          value={kpis.total}
          color="text-primary"
        />
        <KPICard
          icon={<Clock className="h-5 w-5" />}
          label="Pendentes Agora"
          value={kpis.pending}
          color="text-yellow-500"
          alert={kpis.pending > 10}
        />
        <KPICard
          icon={<Timer className="h-5 w-5" />}
          label="Tempo Médio 1ª Resposta"
          value={formatMinutes(kpis.avgFirstResponse)}
          color="text-blue-500"
        />
        <KPICard
          icon={<Zap className="h-5 w-5" />}
          label="SLA (≤15min)"
          value={`${kpis.slaPercent}%`}
          color={kpis.slaPercent >= 80 ? 'text-green-500' : kpis.slaPercent >= 50 ? 'text-yellow-500' : 'text-red-500'}
        />
        <KPICard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Resolvidas"
          value={kpis.resolved}
          color="text-green-500"
        />
        <KPICard
          icon={<Activity className="h-5 w-5" />}
          label="Em Atendimento"
          value={kpis.open}
          color="text-blue-500"
        />
        <KPICard
          icon={<Timer className="h-5 w-5" />}
          label="Tempo Médio Resolução"
          value={formatMinutes(kpis.avgResolution)}
          color="text-purple-500"
        />
        <KPICard
          icon={<Users className="h-5 w-5" />}
          label="Contatos Únicos"
          value={kpis.uniqueContacts}
          color="text-indigo-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily volume */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Volume Diário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Area type="monotone" dataKey="opened" name="Abertas" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                <Area type="monotone" dataKey="resolved" name="Resolvidas" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By channel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conversas por Canal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {channelData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={statusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                />
                <Bar dataKey="value" name="Conversas" radius={[0, 4, 4, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly heatmap */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Horário de Pico</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                />
                <Bar dataKey="count" name="Conversas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By priority */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8 justify-center h-[200px]">
              {priorityData.map((p) => (
                <div key={p.name} className="text-center space-y-2">
                  <div
                    className="mx-auto rounded-full flex items-center justify-center text-white font-bold text-xl"
                    style={{ backgroundColor: p.color, width: Math.max(60, Math.min(120, p.value * 3)), height: Math.max(60, Math.min(120, p.value * 3)) }}
                  >
                    {p.value}
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{p.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── KPI Card Component ──────────────────────────────────────────
function KPICard({ icon, label, value, color, alert }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-yellow-500/50 bg-yellow-500/5' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`${color} shrink-0`}>{icon}</div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
          {alert && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 ml-auto" />}
        </div>
      </CardContent>
    </Card>
  );
}
