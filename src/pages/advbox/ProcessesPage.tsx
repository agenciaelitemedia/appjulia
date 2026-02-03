import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProcessesCache } from '@/hooks/advbox/useProcessesCache';
import { AdvboxAgentSelect } from '@/components/advbox/AdvboxAgentSelect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RefreshCw, 
  Search, 
  Database,
  Users,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  Scale,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { PROCESS_PHASES } from '@/types/advbox';

export default function ProcessesPage() {
  const { user, isAdmin } = useAuth();
  
  const [selectedCodAgent, setSelectedCodAgent] = useState<string | null>(
    isAdmin ? null : (user?.cod_agent?.toString() ?? null)
  );
  
  const [searchQuery, setSearchQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  
  const {
    processes,
    stats,
    total,
    isLoading,
    isSyncing,
    loadProcesses,
    loadStats,
    syncProcesses,
  } = useProcessesCache();

  useEffect(() => {
    if (selectedCodAgent) {
      loadProcesses(selectedCodAgent, { page: currentPage, phase: phaseFilter || undefined, search: searchQuery || undefined });
      loadStats(selectedCodAgent);
    }
  }, [selectedCodAgent, currentPage, phaseFilter, loadProcesses, loadStats]);

  const handleSearch = () => {
    if (selectedCodAgent) {
      setCurrentPage(1);
      loadProcesses(selectedCodAgent, { page: 1, phase: phaseFilter || undefined, search: searchQuery || undefined });
    }
  };

  const handleSync = async () => {
    if (selectedCodAgent) {
      await syncProcesses(selectedCodAgent);
    }
  };

  const totalPages = Math.ceil(total / 50);

  const getPhaseBadgeVariant = (phase: string | null) => {
    if (!phase) return 'secondary';
    const lower = phase.toLowerCase();
    if (lower.includes('judicial')) return 'default';
    if (lower.includes('recursal')) return 'destructive';
    if (lower.includes('execução')) return 'outline';
    return 'secondary';
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/advbox">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-6 w-6" />
              Processos em Cache
            </h1>
            <p className="text-muted-foreground">
              Processos sincronizados do Advbox
            </p>
          </div>
        </div>
        
        {isAdmin && (
          <AdvboxAgentSelect
            value={selectedAgentId}
            onValueChange={setSelectedAgentId}
          />
        )}
      </div>

      {!selectedAgentId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {isAdmin ? 'Selecione um agente para visualizar os processos' : 'Nenhum agente vinculado'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total de Processos</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.total_processes || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Clientes Únicos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.total_clients || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Última Sincronização</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.last_cached_at 
                    ? format(new Date(stats.last_cached_at), "HH:mm", { locale: ptBR })
                    : '--:--'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.last_cached_at 
                    ? format(new Date(stats.last_cached_at), "dd/MM/yyyy", { locale: ptBR })
                    : 'Nunca sincronizado'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Sincronizar</CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleSync} 
                  disabled={isSyncing}
                  className="w-full"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sincronizar Agora
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Buscar por cliente ou número do processo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                
                <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todas as fases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as fases</SelectItem>
                    {PROCESS_PHASES.map((phase) => (
                      <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={handleSearch}>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Processes Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Processos</CardTitle>
              <CardDescription>
                Mostrando {processes.length} de {total} processos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : processes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum processo encontrado</p>
                  <p className="text-sm">Sincronize os processos do Advbox para começar</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Fase</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Última Movimentação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processes.map((process) => (
                        <TableRow key={process.id}>
                          <TableCell className="font-mono text-sm">
                            {process.process_number || '--'}
                          </TableCell>
                          <TableCell>{process.client_name || '--'}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {process.client_phone || '--'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getPhaseBadgeVariant(process.phase)}>
                              {process.phase || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>{process.responsible || '--'}</TableCell>
                          <TableCell>
                            <div className="max-w-[200px]">
                              <p className="text-sm truncate">
                                {process.last_movement_text || 'Sem movimentação'}
                              </p>
                              {process.last_movement_date && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(process.last_movement_date), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Página {currentPage} de {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
