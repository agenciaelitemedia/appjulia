import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { PipelineStats } from '../../hooks/useCRMBoardAnalytics';

interface DealsValueDistributionProps {
  data: PipelineStats[];
}

export function DealsValueDistribution({ data }: DealsValueDistributionProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Filter out zero-value pipelines
  const filteredData = data.filter(d => d.value > 0);
  const totalValue = filteredData.reduce((sum, d) => sum + d.value, 0);

  if (filteredData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Distribuição de Valores</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          Nenhum card com valor definido
        </CardContent>
      </Card>
    );
  }

  const chartData = filteredData.map(d => ({
    ...d,
    valuePercentage: totalValue > 0 ? ((d.value / totalValue) * 100) : 0,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Distribuição de Valores</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string, props: any) => [
                `${formatCurrency(value)} (${props.payload.valuePercentage.toFixed(1)}%)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Legend below */}
        <div className="mt-2 space-y-1">
          {chartData.map(d => (
            <div key={d.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-foreground truncate max-w-[120px]">{d.name}</span>
              </div>
              <span className="text-muted-foreground">
                {formatCurrency(d.value)} ({d.valuePercentage.toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
