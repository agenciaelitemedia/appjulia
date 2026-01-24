import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { FollowupDailyMetrics } from '../../types';

interface FollowupEvolutionChartProps {
  data: FollowupDailyMetrics[];
  isLoading?: boolean;
  granularity?: 'daily' | 'hourly';
}

const chartConfig = {
  messagesSent: {
    label: 'Mensagens Enviadas',
    color: 'hsl(142, 76%, 36%)', // green-600
  },
  stopped: {
    label: 'Respostas',
    color: 'hsl(217, 91%, 60%)', // blue-500
  },
  uniqueLeads: {
    label: 'Leads Únicos',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export function FollowupEvolutionChart({ data, isLoading, granularity = 'daily' }: FollowupEvolutionChartProps) {
  // Dynamic title based on granularity
  const title = granularity === 'hourly' 
    ? 'Evolução por Hora de FollowUps' 
    : 'Evolução Diária de FollowUps';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorStopped" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="label" 
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis 
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <span className="font-medium">{Number(value).toLocaleString('pt-BR')}</span>
                  )}
                />
              }
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="messagesSent"
              name="Mensagens"
              stroke="hsl(142, 76%, 36%)"
              fillOpacity={1}
              fill="url(#colorMessages)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="stopped"
              name="Respostas"
              stroke="hsl(217, 91%, 60%)"
              fillOpacity={1}
              fill="url(#colorStopped)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="uniqueLeads"
              name="Leads"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill="url(#colorLeads)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
