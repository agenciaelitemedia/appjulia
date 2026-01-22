import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { CRMAgentPerformance } from '../../types';

interface AgentPerformanceTableProps {
  data: CRMAgentPerformance[];
  isLoading?: boolean;
}

type SortKey = 'total_leads' | 'conversion_rate' | 'avg_time_days';

export function AgentPerformanceTable({ data, isLoading }: AgentPerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total_leads');
  const [sortAsc, setSortAsc] = useState(false);

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
          Nenhum dado de performance disponível.
        </CardContent>
      </Card>
    );
  }

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const maxLeads = Math.max(...data.map(d => d.total_leads), 1);
  const avgConversion = data.reduce((sum, d) => sum + d.conversion_rate, 0) / data.length;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Agente</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('total_leads')}
              >
                <div className="flex items-center gap-1">
                  Leads
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('conversion_rate')}
              >
                <div className="flex items-center gap-1">
                  Conversão
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('avg_time_days')}
              >
                <div className="flex items-center gap-1">
                  Tempo Médio
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="w-[200px]">Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((agent) => (
              <TableRow key={agent.cod_agent}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{agent.owner_name}</p>
                    <p className="text-xs text-muted-foreground">{agent.cod_agent}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{agent.total_leads}</span>
                    <span className="text-xs text-muted-foreground">
                      ({agent.converted_leads} convertidos)
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={agent.conversion_rate > avgConversion ? 'default' : 'secondary'}
                      className="font-mono"
                    >
                      {agent.conversion_rate.toFixed(1)}%
                    </Badge>
                    {agent.conversion_rate > avgConversion ? (
                      <TrendingUp className="h-4 w-4 text-chart-2" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">
                    {agent.avg_time_days.toFixed(1)}d
                  </span>
                </TableCell>
                <TableCell>
                  <Progress 
                    value={(agent.total_leads / maxLeads) * 100} 
                    className="h-2"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
