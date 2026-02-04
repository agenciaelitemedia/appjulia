import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Globe } from 'lucide-react';
import { CampaignPlatformStats } from '../types';

interface CampanhasByPlatformProps {
  data: CampaignPlatformStats[];
  isLoading: boolean;
}

const platformColors: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  google: '#4285F4',
  outros: '#6B7280',
};

const platformNames: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google',
  outros: 'Outros',
};

export function CampanhasByPlatform({ data, isLoading }: CampanhasByPlatformProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Performance por Plataforma
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(item => ({
    ...item,
    name: platformNames[item.platform.toLowerCase()] || item.platform,
    color: platformColors[item.platform.toLowerCase()] || platformColors.outros,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Performance por Plataforma
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p className="text-sm">Nenhum dado disponível para o período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tickFormatter={(value) => `${value}`} />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={80}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [`${value} leads`, 'Total']}
                labelFormatter={(label) => `${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar 
                dataKey="total_leads" 
                radius={[0, 4, 4, 0]}
                label={{ 
                  position: 'right', 
                  formatter: (value: number) => value,
                  fontSize: 12,
                  fill: 'hsl(var(--muted-foreground))',
                }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        
        {/* Legend */}
        {chartData.length > 0 && (
          <div className="flex flex-wrap gap-4 justify-center mt-4 pt-4 border-t">
            {chartData.map((item) => (
              <div key={item.platform} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-muted-foreground">
                  {item.name}: {item.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
