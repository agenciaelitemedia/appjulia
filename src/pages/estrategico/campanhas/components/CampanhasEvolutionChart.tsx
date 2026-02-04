import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { CampaignEvolutionPoint } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CampanhasEvolutionChartProps {
  data: CampaignEvolutionPoint[];
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
}

export function CampanhasEvolutionChart({ data, isLoading, dateFrom, dateTo }: CampanhasEvolutionChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução de Leads
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
    dateFormatted: format(parseISO(item.date), 'dd/MM', { locale: ptBR }),
  }));

  // Check if we have platform-specific data
  const hasPlatformData = data.some(d => (d.facebook || 0) > 0 || (d.instagram || 0) > 0 || (d.google || 0) > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolução de Leads
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {format(parseISO(dateFrom), "dd 'de' MMMM", { locale: ptBR })} - {format(parseISO(dateTo), "dd 'de' MMMM", { locale: ptBR })}
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            <p className="text-sm">Nenhum dado disponível para o período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
            >
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorFacebook" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1877F2" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#1877F2" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorInstagram" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E4405F" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#E4405F" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorGoogle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4285F4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4285F4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="dateFormatted" 
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Legend />
              
              {hasPlatformData ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="facebook"
                    name="Facebook"
                    stroke="#1877F2"
                    fillOpacity={1}
                    fill="url(#colorFacebook)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="instagram"
                    name="Instagram"
                    stroke="#E4405F"
                    fillOpacity={1}
                    fill="url(#colorInstagram)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="google"
                    name="Google"
                    stroke="#4285F4"
                    fillOpacity={1}
                    fill="url(#colorGoogle)"
                    strokeWidth={2}
                  />
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
