import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { FollowupDailyMetrics } from '../../types';

interface FollowupResponseRateChartProps {
  data: FollowupDailyMetrics[];
  isLoading?: boolean;
  granularity?: 'daily' | 'hourly';
}

const chartConfig = {
  responseRate: {
    label: 'Taxa de Resposta',
    color: 'hsl(262, 83%, 58%)', // purple-500
  },
} satisfies ChartConfig;

export function FollowupResponseRateChart({ data, isLoading, granularity = 'daily' }: FollowupResponseRateChartProps) {
  // Dynamic title based on granularity
  const title = granularity === 'hourly'
    ? 'Evolução por Hora da Taxa de Resposta'
    : 'Evolução da Taxa de Resposta';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
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
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate average response rate
  const averageRate = data.reduce((sum, d) => sum + d.responseRate, 0) / data.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm font-normal text-muted-foreground">
            Média: {averageRate.toFixed(1)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="label" 
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis 
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <span className="font-medium">{Number(value).toFixed(1)}%</span>
                  )}
                />
              }
            />
            <Legend />
            <ReferenceLine 
              y={averageRate} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="5 5"
              label={{ 
                value: 'Média', 
                position: 'insideTopRight',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 12
              }}
            />
            <Line
              type="monotone"
              dataKey="responseRate"
              name="Taxa de Resposta (%)"
              stroke="hsl(262, 83%, 58%)"
              strokeWidth={2}
              dot={{ fill: 'hsl(262, 83%, 58%)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'hsl(262, 83%, 58%)' }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
