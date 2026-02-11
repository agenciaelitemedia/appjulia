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

type SortKey = 'total_leads' | 'qualified_rate' | 'contract_rate' | 'avg_time_days';

function formatAvgTime(days: number): string {
  const totalMinutes = Math.round(days * 24 * 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }
  const totalHours = days * 24;
  if (totalHours < 24) {
    const h = Math.floor(totalHours);
    const m = Math.round((totalHours - h) * 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  const d = Math.floor(days);
  const remainingHours = Math.round((days - d) * 24);
  return remainingHours > 0 ? `${d}d ${remainingHours}h` : `${d}d`;
}

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
  const avgQualified = data.reduce((sum, d) => sum + d.qualified_rate, 0) / data.length;
  const avgContract = data.reduce((sum, d) => sum + d.contract_rate, 0) / data.length;

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
                  Atendimentos
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('qualified_rate')}
              >
                <div className="flex items-center gap-1">
                  Qualificados
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('contract_rate')}
              >
                <div className="flex items-center gap-1">
                  Contratos
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
                      ({agent.qualified_leads} qualificados)
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={agent.qualified_rate > avgQualified ? 'default' : 'secondary'}
                      className="font-mono"
                    >
                      {agent.qualified_rate.toFixed(1)}%
                    </Badge>
                    {agent.qualified_rate > avgQualified ? (
                      <TrendingUp className="h-4 w-4 text-chart-2" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={agent.contract_rate > avgContract ? 'default' : 'secondary'}
                      className="font-mono"
                    >
                      {agent.contract_rate.toFixed(1)}%
                    </Badge>
                    {agent.contract_rate > avgContract ? (
                      <TrendingUp className="h-4 w-4 text-chart-2" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">
                    {formatAvgTime(agent.avg_time_days)}
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
