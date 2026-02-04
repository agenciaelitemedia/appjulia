import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ComposedChart, 
  Bar,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { ConversionEvolutionPoint } from '../hooks/useCampanhasConversionEvolution';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CampanhasConversionEvolutionChartProps {
  data: ConversionEvolutionPoint[];
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
}

export function CampanhasConversionEvolutionChart({ 
  data, 
  isLoading, 
  dateFrom, 
  dateTo 
}: CampanhasConversionEvolutionChartProps) {
  const isSingleDay = dateFrom === dateTo;
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução da Taxa de Conversão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(item => ({
    ...item,
    dateFormatted: isSingleDay 
      ? `${item.date.padStart(2, '0')}h`
      : format(parseISO(item.date), 'dd/MM', { locale: ptBR }),
  }));

  // Calculate average conversion rate
  const avgConversion = chartData.length > 0
    ? chartData.reduce((acc, item) => acc + item.conversion_rate, 0) / chartData.length
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-chart-4" />
              Evolução da Taxa de Conversão
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isSingleDay 
                ? `${format(parseISO(dateFrom), "dd 'de' MMMM", { locale: ptBR })} (por hora)`
                : `${format(parseISO(dateFrom), "dd 'de' MMMM", { locale: ptBR })} - ${format(parseISO(dateTo), "dd 'de' MMMM", { locale: ptBR })}`
              }
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-chart-4">{avgConversion.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">média do período</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            <p className="text-sm">Nenhum dado disponível para o período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
            >
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                </linearGradient>
                <linearGradient id="colorQualified" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="dateFormatted" 
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelFormatter={(label) => isSingleDay ? `Hora: ${label}` : `Data: ${label}`}
                formatter={(value: number | string, name: string) => {
                  const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
                  if (name === 'Taxa de Conversão') return [`${numValue.toFixed(1)}%`, name];
                  return [numValue, name];
                }}
              />
              <Legend />
              
              <Bar
                yAxisId="left"
                dataKey="total_leads"
                name="Total de Leads"
                fill="url(#colorLeads)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="qualified_leads"
                name="Qualificados"
                fill="url(#colorQualified)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="conversion_rate"
                name="Taxa de Conversão"
                stroke="hsl(var(--chart-5))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--chart-5))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
