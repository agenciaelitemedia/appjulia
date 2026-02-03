import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  ReferenceLine,
} from 'recharts';
import type { PipelineStats } from '../../hooks/useCRMBoardAnalytics';

interface PipelineAvgTimeChartProps {
  data: PipelineStats[];
}

export function PipelineAvgTimeChart({ data }: PipelineAvgTimeChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tempo Médio por Etapa</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          Nenhuma etapa configurada
        </CardContent>
      </Card>
    );
  }

  // Calculate average for reference line
  const totalAvg = data.reduce((sum, d) => sum + d.avgDays, 0) / data.length;
  
  // Find max for coloring bottlenecks
  const maxAvg = Math.max(...data.map(d => d.avgDays));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Tempo Médio por Etapa (dias)</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={data.length * 44 + 20}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 50, left: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value} dias`, 'Tempo médio']}
            />
            <ReferenceLine
              x={totalAvg}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
            />
            <Bar
              dataKey="avgDays"
              radius={[0, 4, 4, 0]}
              barSize={28}
            >
              {data.map((entry) => {
                // Highlight bottlenecks (> 1.5x average or highest)
                const isBottleneck = entry.avgDays === maxAvg && maxAvg > 0 && entry.avgDays > totalAvg * 1.5;
                return (
                  <Cell 
                    key={entry.id} 
                    fill={isBottleneck ? '#ef4444' : entry.color}
                    opacity={isBottleneck ? 1 : 0.8}
                  />
                );
              })}
              <LabelList
                dataKey="avgDays"
                position="right"
                style={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                formatter={(value: number) => `${value}d`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        {totalAvg > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Média geral: {totalAvg.toFixed(1)} dias
          </p>
        )}
      </CardContent>
    </Card>
  );
}
