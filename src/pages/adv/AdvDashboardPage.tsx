import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useJuliaAgents, useJuliaContratos, useJuliaContratosPrevious } from '@/pages/estrategico/hooks/useJuliaData';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState } from '@/components/filters/types';
import { ContratosSummary } from '@/pages/estrategico/contratos/components/ContratosSummary';
import { ContratosEvolutionChart } from '@/pages/estrategico/contratos/components/ContratosEvolutionChart';
import { AdvContratosCards } from './components/AdvContratosCards';
import { calculatePeriodDates, QuickPeriod } from '@/hooks/usePersistedPeriod';
import { useDebounce } from '@/hooks/useDebounce';

const ADV_QUICK_PERIODS: { value: QuickPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7days', label: '7 Dias' },
  { value: 'thisMonth', label: 'Mês Atual' },
];

export default function AdvDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const firstName = user?.name?.split(' ')[0] || 'Advogado';

  const { data: agents = [], isLoading: agentsLoading } = useJuliaAgents();
  const agentCode = agents.length > 0 ? agents[0].cod_agent : '';

  // Sempre iniciar com 7 dias
  const initialDates = calculatePeriodDates('last7days');
  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: initialDates.dateFrom,
    dateTo: initialDates.dateTo,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(['EM_CURSO', 'ASSINADO']));
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText, 300);

  const effectiveAgentCodes = agentCode ? [agentCode] : [];

  const { data: contratos = [], isLoading: contratosLoading } = useJuliaContratos({
    ...filters,
    agentCodes: effectiveAgentCodes,
  });
  const { data: previousContratos = [] } = useJuliaContratosPrevious({
    ...filters,
    agentCodes: effectiveAgentCodes,
  });

  const filteredContratos = useMemo(() => {
    let result = contratos.filter(c => {
      if (activeStatuses.has('EM_CURSO') && ['CREATED', 'PENDING'].includes(c.status_document)) return true;
      if (activeStatuses.has('ASSINADO') && c.status_document === 'SIGNED') return true;
      return false;
    });
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase().replace(/\D/g, '') || debouncedSearch.toLowerCase();
      const textTerm = debouncedSearch.toLowerCase();
      result = result.filter(c => {
        const name = (c.signer_name || c.name || '').toLowerCase();
        const doc = (c.cod_document || '').toLowerCase();
        const cpf = (c.signer_cpf || '').replace(/\D/g, '');
        const phone = (c.whatsapp || '').replace(/\D/g, '');
        return name.includes(textTerm) || doc.includes(textTerm) || cpf.includes(term) || phone.includes(term);
      });
    }
    return result;
  }, [contratos, activeStatuses, debouncedSearch]);

  const toggleStatus = (status: string) => {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['julia-contratos-v2'] }),
      queryClient.invalidateQueries({ queryKey: ['julia-contratos-previous'] }),
    ]);
    setIsRefreshing(false);
  };

  const handleFiltersChange = (newFilters: UnifiedFiltersState) => {
    setFilters({ ...newFilters, agentCodes: effectiveAgentCodes });
  };

  if (agentsLoading) {
    return (
      <div className="px-4 py-6 space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!agentCode) {
    return (
      <div className="px-4 py-6">
        <p className="text-muted-foreground text-sm text-center">
          Nenhum agente vinculado ao seu perfil. Contate o administrador.
        </p>
      </div>
    );
  }

  const emCursoCount = contratos.filter(c => ['CREATED', 'PENDING'].includes(c.status_document)).length;
  const assinadoCount = contratos.filter(c => c.status_document === 'SIGNED').length;

  return (
    <div className="px-4 py-4 w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            Olá, {firstName}! 👋
          </h1>
          <p className="text-muted-foreground text-xs">Seus contratos</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters — colapsado por padrão, mostra período no header */}
      <UnifiedFilters
        agents={[]}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        showAgentSelector={false}
        showSearch={false}
        showStatusFilter={false}
        quickPeriods={ADV_QUICK_PERIODS}
        defaultOpen={false}
        showPeriodInHeader={true}
      />

      {/* Search + Status Badges */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF, telefone..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => toggleStatus('EM_CURSO')}
          className="transition-all"
        >
          <Badge
            variant="outline"
            className={`cursor-pointer text-xs px-3 py-1 transition-all ${
              activeStatuses.has('EM_CURSO')
                ? 'bg-yellow-500/15 text-yellow-700 border-yellow-500/50'
                : 'bg-muted/30 text-muted-foreground border-border opacity-50'
            }`}
          >
            Em Curso ({emCursoCount})
          </Badge>
        </button>
        <button
          onClick={() => toggleStatus('ASSINADO')}
          className="transition-all"
        >
          <Badge
            variant="outline"
            className={`cursor-pointer text-xs px-3 py-1 transition-all ${
              activeStatuses.has('ASSINADO')
                ? 'bg-green-500/15 text-green-700 border-green-500/50'
                : 'bg-muted/30 text-muted-foreground border-border opacity-50'
            }`}
          >
            Assinado ({assinadoCount})
          </Badge>
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="painel" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="painel" className="flex-1">Painel</TabsTrigger>
          <TabsTrigger value="contratos" className="flex-1">Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="space-y-4 mt-4">
          <ContratosSummary
            contratos={filteredContratos}
            previousContratos={previousContratos}
            isLoading={contratosLoading}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
          />
          <ContratosEvolutionChart
            contratos={filteredContratos}
            isLoading={contratosLoading}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
          />
        </TabsContent>

        <TabsContent value="contratos" className="mt-4">
          <AdvContratosCards
            contratos={filteredContratos}
            isLoading={contratosLoading}
            agentCode={agentCode}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
