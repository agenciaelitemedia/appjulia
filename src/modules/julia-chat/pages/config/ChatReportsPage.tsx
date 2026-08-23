import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Download, MessageSquare, Clock, CheckCircle2, Star, Inbox, FileText, TrendingUp } from 'lucide-react';
import { useChatAnalytics, type AnalyticsFilters } from '@/hooks/useChatAnalytics';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const formatSec = (s: number | null) => {
  if (s === null) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2, 220 70% 50%))', 'hsl(var(--chart-3, 280 60% 55%))', 'hsl(var(--chart-4, 30 80% 55%))', 'hsl(var(--chart-5, 160 60% 45%))'];

export default function ChatReportsPage() {
  const today = new Date();
  const past = new Date(); past.setDate(today.getDate() - 30);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    startDate: past.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
  });

  const { data, isLoading } = useChatAnalytics(filters);

  const channelData = useMemo(() => Object.entries(data?.byChannel || {}).map(([name, value]) => ({ name, value })), [data]);
  const agentData = useMemo(() => Object.entries(data?.byAgent || {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10), [data]);
  const tagData = useMemo(() => Object.entries(data?.byTag || {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10), [data]);

  const exportCSV = () => {
    if (!data) return;
    const rows: string[] = [];
    rows.push('Métrica,Valor');
    rows.push(`Total de conversas,${data.totalConversations}`);
    rows.push(`Resolvidas,${data.resolvedConversations}`);
    rows.push(`Pendentes,${data.pendingConversations}`);
    rows.push(`Mensagens recebidas,${data.inboundMessages}`);
    rows.push(`Mensagens enviadas,${data.outboundMessages}`);
    rows.push(`Tempo médio 1ª resposta,${formatSec(data.avgFirstResponseSeconds)}`);
    rows.push(`Tempo médio resolução,${formatSec(data.avgResolutionSeconds)}`);
    rows.push(`SLA (%),${data.slaCompliancePct ?? '—'}`);
    rows.push(`CSAT médio,${data.csatAvg ?? '—'}`);
    rows.push('');
    rows.push('Data,Conversas,Resolvidas,Mensagens');
    data.byDay.forEach(d => rows.push(`${d.date},${d.conversations},${d.resolved},${d.messages}`));
    rows.push('');
    rows.push('Canal,Conversas');
    Object.entries(data.byChannel).forEach(([k, v]) => rows.push(`${k},${v}`));
    rows.push('');
    rows.push('Agente,Conversas');
    Object.entries(data.byAgent).forEach(([k, v]) => rows.push(`${k},${v}`));

    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio-${filters.startDate}-${filters.endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => window.print();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" /> Relatórios & Analytics</h1>
          <p className="text-sm text-muted-foreground">Visão completa da operação de atendimento.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />CSV</Button>
          <Button variant="outline" onClick={exportPDF}><FileText className="h-4 w-4 mr-2" />PDF</Button>
        </div>
      </div>

      <Card className="p-4 grid gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <Label>Data inicial</Label>
          <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Data final</Label>
          <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Canal</Label>
          <Select value={filters.channel || 'all'} onValueChange={(v) => setFilters({ ...filters, channel: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="whatsapp_uazapi">WhatsApp (UaZapi)</SelectItem>
              <SelectItem value="whatsapp_waba">WhatsApp Oficial</SelectItem>
              <SelectItem value="webchat">Webchat</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Agente</Label>
          <Input placeholder="ID do agente (opcional)" value={filters.agent || ''} onChange={(e) => setFilters({ ...filters, agent: e.target.value || undefined })} />
        </div>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {data && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <KPI icon={Inbox} label="Conversas" value={data.totalConversations} sub={`${data.resolvedConversations} resolvidas`} />
            <KPI icon={MessageSquare} label="Mensagens" value={data.totalMessages} sub={`${data.inboundMessages} in / ${data.outboundMessages} out`} />
            <KPI icon={Clock} label="1ª resposta" value={formatSec(data.avgFirstResponseSeconds)} sub={`SLA ${data.slaCompliancePct ?? '—'}%`} />
            <KPI icon={Star} label="CSAT" value={data.csatAvg ?? '—'} sub={`${data.csatResponses} respostas`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Volume diário</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.byDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Line type="monotone" dataKey="conversations" stroke="hsl(var(--primary))" name="Conversas" strokeWidth={2} />
                    <Line type="monotone" dataKey="resolved" stroke="hsl(160 60% 45%)" name="Resolvidas" strokeWidth={2} />
                    <Line type="monotone" dataKey="messages" stroke="hsl(280 60% 55%)" name="Mensagens" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Distribuição por canal</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelData} dataKey="value" nameKey="name" outerRadius={90} label>
                      {channelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Top agentes</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agentData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Tags mais usadas</h3>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {tagData.length === 0 && <p className="text-sm text-muted-foreground">Sem tags no período.</p>}
                {tagData.map((t) => (
                  <div key={t.name} className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">{t.name}</Badge>
                    <div className="flex-1 h-2 bg-muted rounded">
                      <div className="h-full bg-primary rounded" style={{ width: `${(t.value / tagData[0].value) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono w-10 text-right">{t.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub }: { icon: any; label: string; value: any; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
