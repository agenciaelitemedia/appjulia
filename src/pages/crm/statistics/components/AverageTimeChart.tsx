import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { CRMAvgTimeData } from '../../types';

interface AverageTimeChartProps {
  data: CRMAvgTimeData[];
  isLoading?: boolean;
}

export function AverageTimeChart({ data, isLoading }: AverageTimeChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Nenhum dado disponível para o período selecionado.
        </CardContent>
      </Card>
    );
  }

  const avgTotal = data.reduce((sum, item) => sum + item.avg_days, 0) / data.length;

  return (
    <Card>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 60, left: 10, bottom: 10 }}
          >
            <XAxis type="number" hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={120}
              tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as CRMAvgTimeData;
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Tempo médio: {item.avg_days.toFixed(1)} dias
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey="avg_days" 
              radius={[0, 4, 4, 0]}
              maxBarSize={40}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <LabelList 
                dataKey="avg_days" 
                position="right" 
                fill="hsl(var(--foreground))"
                fontSize={12}
                formatter={(value: number) => `${value.toFixed(1)}d`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Média geral</p>
            <p className="text-lg font-semibold text-foreground">{avgTotal.toFixed(1)} dias</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Estágio mais lento</p>
            <p className="text-lg font-semibold text-foreground">
              {data.reduce((max, item) => item.avg_days > max.avg_days ? item : max, data[0])?.name || '-'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
