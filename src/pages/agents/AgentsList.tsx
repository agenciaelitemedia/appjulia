import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Plus,
  Pencil,
  Eye,
  Settings,
  Trash2,
  QrCode,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { externalDb } from '@/lib/externalDb';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { useAgentsList, AgentListItem } from './hooks/useAgentsList';
import { usePlans } from './hooks/usePlans';
import { BusinessHoursBadge } from '@/components/BusinessHoursBadge';

type SortKey = 'status' | 'cod_agent' | 'business_name' | 'plan_name' | 'leads_received' | 'last_used' | 'due_date';

const ITEMS_PER_PAGE = 20;

// Helper functions
const formatDueDate = (value: number | string | null): { text: string; diffDays: number } | null => {
  // Retorna null para valores inválidos: null, undefined, 0, "0", string vazia
  if (!value || value === 0 || value === '0') return null;
  
  const dueDate = new Date(value);
  
  // Verifica se a data é válida
  if (isNaN(dueDate.getTime())) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { text: `Dia ${dueDate.getDate()}`, diffDays };
};

const formatLastUsed = (value: number | string | null): string => {
  // Retorna '-' para valores inválidos: null, undefined, 0, "0", string vazia
  if (!value || value === 0 || value === '0') return '-';
  
  const lastDate = new Date(value);
  
  // Verifica se a data é válida
  if (isNaN(lastDate.getTime())) return '-';
  
  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays}d atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem atrás`;
  return `${Math.floor(diffDays / 30)}m atrás`;
};

const getDueDateVariant = (diffDays: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (diffDays < 0) return 'destructive';
  if (diffDays <= 30) return 'secondary';
  return 'default';
};

const getUsageVariant = (used: number, limit: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (limit === 0) return 'outline';
  const percentage = (used / limit) * 100;
  if (percentage >= 100) return 'destructive';
  if (percentage >= 80) return 'secondary';
  return 'default';
};

const STORAGE_KEY = 'agents-list-filters';

interface StoredFilters {
  showLegacy: boolean;
  statusFilter: 'all' | 'active' | 'inactive';
  planFilter: string;
}

function loadStoredFilters(): StoredFilters {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load stored filters:', e);
  }
  return { showLegacy: false, statusFilter: 'all', planFilter: 'all' };
}

export default function AgentsList() {
  const storedFilters = loadStoredFilters();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLegacy, setShowLegacy] = useState(storedFilters.showLegacy);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(storedFilters.statusFilter);
  const [planFilter, setPlanFilter] = useState<string>(storedFilters.planFilter);
  const [agentToToggle, setAgentToToggle] = useState<AgentListItem | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'business_name',
    direction: 'asc',
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Persist filters to localStorage
  useEffect(() => {
    const filters: StoredFilters = { showLegacy, statusFilter, planFilter };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [showLegacy, statusFilter, planFilter]);
  
  // React Query for optimized data fetching with caching
  const { data: agents = [], isLoading, refetch } = useAgentsList(showLegacy);
  const { plans } = usePlans();
  
  // Debounced search for better performance
  const debouncedSearch = useDebounce(searchTerm, 300);

  const confirmToggle = async () => {
    if (!agentToToggle) return;
    
    const newStatus = !agentToToggle.status;
    try {
      await externalDb.update({
        table: 'agents',
        data: { status: newStatus },
        where: { id: agentToToggle.id },
      });
      // Refetch to update the cache with new status
      await refetch();
      toast({
        title: newStatus ? 'Agente ativado' : 'Agente desativado',
        description: `${agentToToggle.business_name || agentToToggle.client_name} foi ${newStatus ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível alterar o status do agente.',
      });
    } finally {
      setAgentToToggle(null);
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-1 h-3 w-3" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3" /> 
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Filter by debounced search term, status, and plan
  const filteredAgents = useMemo(() => {
    let result = agents;
    
    // Filtro por busca textual
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter(agent =>
        agent.business_name?.toLowerCase().includes(term) ||
        agent.client_name?.toLowerCase().includes(term) ||
        agent.cod_agent?.toLowerCase().includes(term)
      );
    }
    
    // Filtro por status
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      result = result.filter(agent => agent.status === isActive);
    }
    
    // Filtro por plano
    if (planFilter !== 'all') {
      result = result.filter(agent => agent.plan_name === planFilter);
    }
    
    return result;
  }, [agents, debouncedSearch, statusFilter, planFilter]);

  // Sort agents
  const sortedAgents = useMemo(() => {
    const sorted = [...filteredAgents].sort((a, b) => {
      let aVal: string | number | boolean | null;
      let bVal: string | number | boolean | null;

      switch (sortConfig.key) {
        case 'status':
          aVal = a.status ? 1 : 0;
          bVal = b.status ? 1 : 0;
          break;
        case 'cod_agent':
          aVal = a.cod_agent || '';
          bVal = b.cod_agent || '';
          break;
        case 'business_name':
          aVal = a.business_name || a.client_name || '';
          bVal = b.business_name || b.client_name || '';
          break;
        case 'plan_name':
          aVal = a.plan_name || '';
          bVal = b.plan_name || '';
          break;
        case 'leads_received':
          aVal = a.leads_received;
          bVal = b.leads_received;
          break;
        case 'last_used':
          aVal = (a.last_used && a.last_used !== 0 && a.last_used !== '0') 
            ? new Date(a.last_used).getTime() 
            : 0;
          bVal = (b.last_used && b.last_used !== 0 && b.last_used !== '0') 
            ? new Date(b.last_used).getTime() 
            : 0;
          break;
        case 'due_date':
          aVal = (a.due_date && a.due_date !== 0 && a.due_date !== '0') 
            ? new Date(a.due_date).getTime() 
            : 0;
          bVal = (b.due_date && b.due_date !== 0 && b.due_date !== '0') 
            ? new Date(b.due_date).getTime() 
            : 0;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
    return sorted;
  }, [filteredAgents, sortConfig]);

  // Pagination logic
  const totalPages = Math.ceil(sortedAgents.length / ITEMS_PER_PAGE);
  const paginatedAgents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedAgents.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedAgents, currentPage]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, planFilter]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-72 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-80" />
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Cod. Agente</TableHead>
                <TableHead>Nome/Escritório</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Limite/Uso</TableHead>
                <TableHead>Last</TableHead>
                <TableHead>Venci.</TableHead>
                <TableHead className="w-[50px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-11" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-32 mb-1" />
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  // Empty state
  if (agents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agentes IA</h1>
            <p className="text-muted-foreground">
              Gerencie seus agentes Julia e instâncias do WhatsApp
            </p>
          </div>
          <Button onClick={() => navigate('/admin/agentes-novo')}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Agente
          </Button>
        </div>
        <Card className="flex flex-col items-center justify-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="mb-2">Nenhum agente encontrado</CardTitle>
          <CardDescription className="mb-4">
            Crie seu primeiro agente Julia para começar
          </CardDescription>
          <Button onClick={() => navigate('/admin/agentes-novo')}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Agente
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agentes IA</h1>
          <p className="text-muted-foreground">
            Gerencie seus agentes Julia e instâncias do WhatsApp
          </p>
        </div>
        <Button onClick={() => navigate('/admin/agentes-novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Agente
        </Button>
      </div>

      {/* Search Field and Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Campo de Busca */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Filtro por Status */}
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Filtro por Plano */}
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Planos</SelectItem>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.name}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Toggle Mostrar Legado */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-legacy"
            checked={showLegacy}
            onCheckedChange={(checked) => setShowLegacy(checked === true)}
          />
          <label 
            htmlFor="show-legacy" 
            className="text-sm text-muted-foreground cursor-pointer select-none"
          >
            Mostrar Legado
          </label>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px] text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 font-medium"
                  onClick={() => handleSort('status')}
                >
                  Status
                  {getSortIcon('status')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 font-medium"
                  onClick={() => handleSort('cod_agent')}
                >
                  Cod. Agente
                  {getSortIcon('cod_agent')}
                </Button>
              </TableHead>
              <TableHead className="w-[90px] text-center">Horário</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 -ml-2 font-medium"
                  onClick={() => handleSort('business_name')}
                >
                  Nome/Escritório
                  {getSortIcon('business_name')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 font-medium"
                  onClick={() => handleSort('plan_name')}
                >
                  Plano
                  {getSortIcon('plan_name')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 font-medium"
                  onClick={() => handleSort('leads_received')}
                >
                  Limite/Uso
                  {getSortIcon('leads_received')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 font-medium"
                  onClick={() => handleSort('last_used')}
                >
                  Last
                  {getSortIcon('last_used')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 font-medium"
                  onClick={() => handleSort('due_date')}
                >
                  Venci.
                  {getSortIcon('due_date')}
                </Button>
              </TableHead>
              <TableHead className="w-[50px] text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAgents.map((agent) => {
              const dueDateInfo = formatDueDate(agent.due_date);
              
              return (
                <TableRow key={agent.id}>
                  <TableCell className="text-center">
                    <Switch
                      checked={agent.status === true}
                      onCheckedChange={() => setAgentToToggle(agent)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm text-center">
                    {agent.cod_agent}
                  </TableCell>
                  <TableCell className="text-center">
                    <BusinessHoursBadge settings={agent.settings} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {agent.business_name || agent.client_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {agent.plan_name || (
                      <span className="text-muted-foreground">Sem plano</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getUsageVariant(agent.leads_received, agent.plan_limit)}>
                      {agent.leads_received}/{agent.plan_limit}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground text-center">
                    {formatLastUsed(agent.last_used)}
                  </TableCell>
                  <TableCell className="text-center">
                    {dueDateInfo ? (
                      <Badge variant={getDueDateVariant(dueDateInfo.diffDays)}>
                        {dueDateInfo.text}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/agentes/${agent.id}/detalhes`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/admin/agentes/${agent.id}/editar`)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/agente/personalizacao?id=${agent.id}`)}>
                          <Settings className="mr-2 h-4 w-4" />
                          Configurar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <QrCode className="mr-2 h-4 w-4" />
                          QR Code
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Ver conversas
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, sortedAgents.length)} de {sortedAgents.length} agentes
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!agentToToggle} onOpenChange={() => setAgentToToggle(null)}>
        <AlertDialogContent>
        <AlertDialogHeader>
            <AlertDialogTitle>
              {agentToToggle?.status ? 'Desativar' : 'Ativar'} agente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O agente <strong>{agentToToggle?.business_name || agentToToggle?.client_name}</strong> será{' '}
              {agentToToggle?.status ? 'desativado' : 'ativado'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
