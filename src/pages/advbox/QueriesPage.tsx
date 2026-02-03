import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useClientQueries, ClientQueriesFilters } from '@/hooks/advbox/useClientQueries';
import { AdvboxAgentSelect } from '@/components/advbox/AdvboxAgentSelect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Clock,
  FileSearch,
  TrendingUp,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const QUERY_TYPES = [
  { value: 'status_processo', label: 'Status do Processo' },
  { value: 'movimentacao', label: 'Movimentação' },
  { value: 'prazo', label: 'Prazo' },
  { value: 'audiencia', label: 'Audiência' },
  { value: 'geral', label: 'Geral' },
];

export default function AdvboxQueriesPage() {
  const { queries, total, stats, isLoading, loadQueries } = useClientQueries();
  const [selectedCodAgent, setSelectedCodAgent] = useState<string | null>(null);
  const [filters, setFilters] = useState<ClientQueriesFilters>({
    page: 1,
    limit: 20,
  });

  useEffect(() => {
    if (selectedCodAgent) {
      loadQueries(selectedCodAgent, filters);
    }
  }, [selectedCodAgent, filters, loadQueries]);

  const handleFilterChange = (key: keyof ClientQueriesFilters, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
      page: 1,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const getQueryTypeBadge = (queryType: string) => {
    const type = QUERY_TYPES.find(t => t.value === queryType);
    return (
      <Badge variant="secondary">
        {type?.label || queryType}
      </Badge>
    );
  };

  const totalPages = Math.ceil(total / (filters.limit || 20));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/advbox">
            <ChevronLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Consultas de Clientes</h1>
            <p className="text-muted-foreground">Histórico de consultas via Julia IA</p>
          </div>
        </div>
      </div>

      {/* Agent Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecionar Agente</CardTitle>
        </CardHeader>
        <CardContent>
          <AdvboxAgentSelect
            value={selectedCodAgent}
            onValueChange={setSelectedCodAgent}
            placeholder="Selecione um agente..."
          />
        </CardContent>
      </Card>

      {selectedCodAgent && (
        <>
          {/* Statistics */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.total_queries}</p>
                      <p className="text-xs text-muted-foreground">Total de Consultas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.avg_response_time_ms}ms</p>
                      <p className="text-xs text-muted-foreground">Tempo Médio</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileSearch className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.avg_processes_found.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">Processos Médios</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {stats.total_queries > 0 
                          ? ((stats.queries_with_results / stats.total_queries) * 100).toFixed(0)
                          : 0}%
                      </p>
                      <p className="text-xs text-muted-foreground">Com Resultados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-4 h-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Select
                    value={filters.query_type || 'all'}
                    onValueChange={(value) => handleFilterChange('query_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de consulta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {QUERY_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    type="date"
                    placeholder="Data inicial"
                    value={filters.start_date || ''}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    type="date"
                    placeholder="Data final"
                    value={filters.end_date || ''}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Telefone"
                    value={filters.client_phone || ''}
                    onChange={(e) => handleFilterChange('client_phone', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Histórico de Consultas</CardTitle>
                <CardDescription>{total} registros encontrados</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedCodAgent && loadQueries(selectedCodAgent, filters)}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : queries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma consulta encontrada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Processos</TableHead>
                      <TableHead className="text-right">Tempo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queries.map((query) => (
                      <TableRow key={query.id}>
                        <TableCell>
                          {format(new Date(query.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{query.client_name || '—'}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {query.client_phone}
                        </TableCell>
                        <TableCell>{getQueryTypeBadge(query.query_type)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={query.found_processes > 0 ? 'default' : 'secondary'}>
                            {query.found_processes}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {query.query_time_ms}ms
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {filters.page} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange((filters.page || 1) - 1)}
                      disabled={(filters.page || 1) <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange((filters.page || 1) + 1)}
                      disabled={(filters.page || 1) >= totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* No Agent Selected */}
      {!selectedCodAgent && (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Selecione um Agente</h3>
            <p className="text-muted-foreground">
              Escolha um agente acima para visualizar o histórico de consultas
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
