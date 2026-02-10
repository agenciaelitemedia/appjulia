import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { JuliaSessao } from '../../types';
import { parseDbTimestamp } from '@/lib/dateUtils';
import { format, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DesempenhoEvolutionChartProps {
  sessoes: JuliaSessao[];
  isLoading?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export function DesempenhoEvolutionChart({ sessoes, isLoading, dateFrom, dateTo }: DesempenhoEvolutionChartProps) {
  // Check if filter is for a single day
  const isSingleDay = useMemo(() => {
    if (!dateFrom || !dateTo) return false;
    try {
      return isSameDay(parseISO(dateFrom), parseISO(dateTo));
    } catch {
      return false;
    }
  }, [dateFrom, dateTo]);

  const chartData = useMemo(() => {
    if (isSingleDay) {
      // Group by hour when single day filter
      const grouped: Record<string, { sessoes: number; mensagens: number }> = {};
      
      // Initialize all 24 hours
      for (let h = 0; h < 24; h++) {
        const hourKey = h.toString().padStart(2, '0');
        grouped[hourKey] = { sessoes: 0, mensagens: 0 };
      }
      
      sessoes.forEach((s) => {
        const date = parseDbTimestamp(s.created_at);
        const hourKey = format(date, 'HH');
        
        if (grouped[hourKey]) {
          grouped[hourKey].sessoes += 1;
          grouped[hourKey].mensagens += s.total_msg || 0;
        }
      });
      
      return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, data]) => ({
          date: hour,
          label: `${hour}h`,
          ...data,
        }));
    } else {
      // Group by day for multiple days
      const grouped: Record<string, { sessoes: number; mensagens: number }> = {};
      
      sessoes.forEach((s) => {
        const date = parseDbTimestamp(s.created_at);
        const key = format(date, 'yyyy-MM-dd');
        
        if (!grouped[key]) {
          grouped[key] = { sessoes: 0, mensagens: 0 };
        }
        
        grouped[key].sessoes += 1;
        grouped[key].mensagens += s.total_msg || 0;
      });
      
      return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
          date,
          label: format(new Date(date), 'dd/MM', { locale: ptBR }),
          ...data,
        }));
    }
  }, [sessoes, isSingleDay]);

  const chartTitle = isSingleDay ? 'Evolução de Atendimentos por Hora' : 'Evolução de Atendimentos por Dia';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolução de Atendimentos</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  if (sessoes.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{chartTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSessoes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorMensagens" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              allowDecimals={false}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="sessoes"
              name="Atendimentos"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill="url(#colorSessoes)"
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="mensagens"
              name="Mensagens"
              stroke="#22c55e"
              fillOpacity={1}
              fill="url(#colorMensagens)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
