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
import { CRMFunnelData } from '../../types';

interface ConversionFunnelChartProps {
  data: CRMFunnelData[];
  isLoading?: boolean;
}

export function ConversionFunnelChart({ data, isLoading }: ConversionFunnelChartProps) {
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

  const total = data.reduce((sum, item) => sum + item.count, 0);

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
                  const item = payload[0].payload as CRMFunnelData;
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.count} leads ({item.percentage.toFixed(1)}%)
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey="count" 
              radius={[0, 4, 4, 0]}
              maxBarSize={40}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <LabelList 
                dataKey="count" 
                position="right" 
                fill="hsl(var(--foreground))"
                fontSize={12}
                formatter={(value: number) => `${value} (${((value / total) * 100).toFixed(0)}%)`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Conversion between stages */}
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">Conversão entre estágios:</p>
          <div className="flex flex-wrap gap-2">
            {data.slice(0, -1).map((stage, index) => {
              const nextStage = data[index + 1];
              const conversionRate = stage.count > 0 
                ? ((nextStage.count / stage.count) * 100).toFixed(0) 
                : '0';
              return (
                <div 
                  key={stage.id}
                  className="text-xs bg-muted px-2 py-1 rounded"
                >
                  <span className="font-medium">{stage.name.substring(0, 3)}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="font-medium">{nextStage.name.substring(0, 3)}</span>
                  <span className="text-muted-foreground">: </span>
                  <span className="text-foreground">{conversionRate}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
