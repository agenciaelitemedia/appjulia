import { useMemo } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import type { DashboardFunnelData } from '../hooks/useDashboardData';

interface DashboardFunnelChartProps {
  data: DashboardFunnelData[];
  isLoading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: DashboardFunnelData }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;

  const item = payload[0].payload;

  return (
    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="font-medium">{item.name}</span>
      </div>
      <div className="text-muted-foreground">
        <p>Quantidade: <span className="font-medium text-foreground">{item.count}</span></p>
        <p>Percentual: <span className="font-medium text-foreground">{item.percentage.toFixed(1)}%</span></p>
      </div>
    </div>
  );
}

export function DashboardFunnelChart({ data, isLoading }: DashboardFunnelChartProps) {
  // Calculate conversion rates between stages
  const conversionRates = useMemo(() => {
    const rates: { from: string; to: string; rate: number }[] = [];
    for (let i = 0; i < data.length - 1; i++) {
      const current = data[i];
      const next = data[i + 1];
      if (current.count > 0) {
        rates.push({
          from: current.name,
          to: next.name,
          rate: (next.count / current.count) * 100,
        });
      }
    }
    return rates;
  }, [data]);

  // Custom label renderer
  const renderLabel = (props: { x: number; y: number; width: number; height: number; value: number; index: number }) => {
    const { x, y, width, height, value, index } = props;
    const item = data[index];
    if (!item) return null;

    return (
      <text
        x={x + width + 8}
        y={y + height / 2}
        fill="hsl(var(--foreground))"
        textAnchor="start"
        dominantBaseline="middle"
        fontSize={12}
      >
        {value} ({item.percentage.toFixed(0)}%)
      </text>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Gráfico de Etapas</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível para o período selecionado.
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartHeight = Math.max(200, data.length * 40);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Funil de Conversão</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 80, left: 0, bottom: 5 }}
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
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={32}>
              {data.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
              <LabelList content={renderLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Conversion rates between stages */}
        {conversionRates.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Conversão entre estágios:
            </p>
            <div className="flex flex-wrap gap-2">
              {conversionRates.slice(0, 4).map((conv, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {conv.from.slice(0, 3)}
                  <ArrowRight className="h-3 w-3 mx-1" />
                  {conv.to.slice(0, 3)}: {conv.rate.toFixed(0)}%
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
