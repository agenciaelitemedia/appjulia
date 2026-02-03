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
} from 'recharts';
import type { PipelineStats } from '../../hooks/useCRMBoardAnalytics';

interface PipelineFunnelChartProps {
  data: PipelineStats[];
}

export function PipelineFunnelChart({ data }: PipelineFunnelChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          Nenhuma etapa configurada
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Funil de Conversão</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={data.length * 44 + 20}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
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
              formatter={(value: number, name: string, props: any) => [
                `${value} cards (${props.payload.percentage.toFixed(1)}%)`,
                'Quantidade',
              ]}
            />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              barSize={28}
            >
              {data.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        {/* Conversion rates between stages */}
        {data.length > 1 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Taxa entre etapas:</p>
            <div className="flex flex-wrap gap-2">
              {data.slice(0, -1).map((stage, idx) => {
                const nextStage = data[idx + 1];
                const rate = stage.count > 0 
                  ? ((nextStage.count / stage.count) * 100).toFixed(0)
                  : '0';
                return (
                  <span
                    key={stage.id}
                    className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
                  >
                    {stage.name.substring(0, 8)}... → {nextStage.name.substring(0, 8)}...: {rate}%
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
