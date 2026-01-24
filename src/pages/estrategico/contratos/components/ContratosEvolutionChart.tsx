import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { JuliaContrato } from '../../types';
import { parseDbTimestamp } from '@/lib/dateUtils';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContratosEvolutionChartProps {
  contratos: JuliaContrato[];
  isLoading?: boolean;
}

export function ContratosEvolutionChart({ contratos, isLoading }: ContratosEvolutionChartProps) {
  // Group by day
  const dailyData = useMemo(() => {
    const grouped: Record<string, { total: number; signed: number; pending: number }> = {};
    
    contratos.forEach((c) => {
      const date = parseDbTimestamp(c.data_contrato);
      const key = format(date, 'yyyy-MM-dd');
      
      if (!grouped[key]) {
        grouped[key] = { total: 0, signed: 0, pending: 0 };
      }
      
      grouped[key].total += 1;
      if (c.status_document === 'SIGNED') {
        grouped[key].signed += 1;
      } else {
        grouped[key].pending += 1;
      }
    });
    
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        label: format(new Date(date), 'dd/MM', { locale: ptBR }),
        ...data,
      }));
  }, [contratos]);

  // Group by week
  const weeklyData = useMemo(() => {
    const grouped: Record<string, { total: number; signed: number; pending: number; weekStart: Date }> = {};
    
    contratos.forEach((c) => {
      const date = parseDbTimestamp(c.data_contrato);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const key = format(weekStart, 'yyyy-MM-dd');
      
      if (!grouped[key]) {
        grouped[key] = { total: 0, signed: 0, pending: 0, weekStart };
      }
      
      grouped[key].total += 1;
      if (c.status_document === 'SIGNED') {
        grouped[key].signed += 1;
      } else {
        grouped[key].pending += 1;
      }
    });
    
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => {
        const weekEnd = endOfWeek(data.weekStart, { weekStartsOn: 1 });
        return {
          label: `${format(data.weekStart, 'dd/MM', { locale: ptBR })} - ${format(weekEnd, 'dd/MM', { locale: ptBR })}`,
          total: data.total,
          signed: data.signed,
          pending: data.pending,
        };
      });
  }, [contratos]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolução de Contratos</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  if (contratos.length === 0) {
    return null;
  }

  const renderChart = (data: Array<{ label: string; total: number; signed: number; pending: number }>) => (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorSigned" x1="0" y1="0" x2="0" y2="1">
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
          type="monotone"
          dataKey="total"
          name="Total"
          stroke="hsl(var(--primary))"
          fillOpacity={1}
          fill="url(#colorTotal)"
        />
        <Area
          type="monotone"
          dataKey="signed"
          name="Assinados"
          stroke="#22c55e"
          fillOpacity={1}
          fill="url(#colorSigned)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Evolução de Contratos</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="daily">Por Dia</TabsTrigger>
            <TabsTrigger value="weekly">Por Semana</TabsTrigger>
          </TabsList>
          <TabsContent value="daily">
            {dailyData.length > 0 ? renderChart(dailyData) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </TabsContent>
          <TabsContent value="weekly">
            {weeklyData.length > 0 ? renderChart(weeklyData) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
