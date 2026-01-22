import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import { CRMStageBottleneck } from '../../types';

interface StageBottlenecksProps {
  data: CRMStageBottleneck[];
  isLoading?: boolean;
}

export function StageBottlenecks({ data, isLoading }: StageBottlenecksProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Nenhum dado de gargalos disponível.
        </CardContent>
      </Card>
    );
  }

  const avgCount = data.length > 0 
    ? data.reduce((sum, d) => sum + d.count, 0) / data.length 
    : 0;
  
  const bottlenecks = data.filter(d => d.is_bottleneck);

  return (
    <Card>
      <CardContent className="p-4">
        {/* Bottleneck alerts */}
        {bottlenecks.length > 0 && (
          <div className="mb-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {bottlenecks.length} estágio{bottlenecks.length > 1 ? 's' : ''} com gargalo
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {bottlenecks.map(b => (
                <Badge 
                  key={b.id} 
                  variant="outline"
                  style={{ borderColor: b.color }}
                >
                  {b.name}: {b.count} leads (+{((b.count / avgCount - 1) * 100).toFixed(0)}%)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Chart */}
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={100}
              tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine 
              x={avgCount} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="3 3"
              label={{ 
                value: `Média: ${avgCount.toFixed(0)}`, 
                position: 'top',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 10
              }}
            />
            <Bar 
              dataKey="count" 
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.is_bottleneck ? 'hsl(var(--destructive))' : entry.color} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-destructive" />
            <span>Gargalo (&gt;30% acima da média)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted" />
            <span>Normal</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
