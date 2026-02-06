import { useState, useCallback } from 'react';
import { Scale, Search, History, Info, Clock, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { SearchType, ProcessHit, ProcessData } from './types';
import { SearchTypeSelector } from './components/SearchTypeSelector';
import { SearchBar } from './components/SearchBar';
import { TribunalSelector } from './components/TribunalSelector';
import { SearchProgress } from './components/SearchProgress';
import { ProcessCard } from './components/ProcessCard';
import { ProcessDetailsSheet } from './components/ProcessDetailsSheet';
import { useDataJudSearch } from './hooks/useDataJudSearch';
import { useTribunalList } from './hooks/useTribunalList';
import { useEnsureDataJudModule } from './hooks/useEnsureDataJudModule';
import { formatDate } from './utils';

export default function DataJudSearchPage() {
  // Ensure DataJud module is registered in the system
  useEnsureDataJudModule();

  const [searchType, setSearchType] = useState<SearchType>('process_number');
  const [selectedTribunals, setSelectedTribunals] = useState<string[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<{ process: ProcessData; tribunal: string } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: tribunals } = useTribunalList();
  const {
    search,
    clearResults,
    clearHistory,
    results,
    totalResults,
    searchedTribunals,
    responseTime,
    isSearching,
    searchHistory,
  } = useDataJudSearch();

  const handleSearch = useCallback(
    (query: string) => {
      search({
        type: searchType,
        query,
        tribunals: selectedTribunals.length > 0 ? selectedTribunals : undefined,
      });
    },
    [search, searchType, selectedTribunals]
  );

  const handleViewDetails = useCallback((hit: ProcessHit, tribunal: string) => {
    setSelectedProcess({ process: hit._source, tribunal });
    setDetailsOpen(true);
  }, []);

  const handleSearchTypeChange = useCallback((type: SearchType) => {
    setSearchType(type);
    clearResults();
  }, [clearResults]);

  const hasResults = results.length > 0;
  const hasSearched = searchedTribunals > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
            <Scale className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Busca Processual Nacional
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Consulte processos em todos os tribunais do Brasil através da base de dados
            pública do CNJ (DataJud)
          </p>
        </div>

        {/* Search Card */}
        <Card className="mb-8 border-2 shadow-xl shadow-primary/5">
          <CardContent className="p-6 space-y-6">
            {/* Search Type Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Buscar por
              </label>
              <SearchTypeSelector
                value={searchType}
                onChange={handleSearchTypeChange}
                disabled={isSearching}
              />
            </div>

            {/* Search Bar */}
            <SearchBar
              searchType={searchType}
              onSearchTypeChange={handleSearchTypeChange}
              onSearch={handleSearch}
              isSearching={isSearching}
            />

            {/* Tribunal Selector */}
            <div className="flex flex-wrap items-center gap-4">
              <TribunalSelector
                value={selectedTribunals}
                onChange={setSelectedTribunals}
                disabled={isSearching}
              />
              {selectedTribunals.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  Buscará em todos os {tribunals?.length || 91} tribunais
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {(isSearching || hasSearched) && (
          <div className="mb-8">
            <SearchProgress
              isSearching={isSearching}
              searchedTribunals={searchedTribunals}
              totalTribunals={selectedTribunals.length || tribunals?.length || 91}
              responseTime={responseTime}
              resultsCount={totalResults}
            />
          </div>
        )}

        {/* Results */}
        {isSearching ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-5">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                  <Skeleton className="h-6 w-3/4" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        ) : hasResults ? (
          <div className="space-y-8">
            {results.map((tribunalResult) => (
              <div key={tribunalResult.tribunal}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    {tribunalResult.tribunal}
                    <span className="text-muted-foreground font-normal ml-2">
                      ({tribunalResult.total} processo{tribunalResult.total !== 1 && 's'})
                    </span>
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {tribunalResult.hits.map((hit) => (
                    <ProcessCard
                      key={hit._id}
                      hit={hit}
                      tribunalKey={tribunalResult.tribunal}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : hasSearched ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum processo encontrado</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Verifique se o número do processo, CNPJ ou OAB está correto.
                Alguns processos podem estar em segredo de justiça.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Scale className="h-10 w-10 text-primary/60" />
              </div>
              <h3 className="text-lg font-medium mb-2">Pronto para buscar</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Digite o número do processo, CNPJ ou OAB para consultar
                processos em todos os tribunais do Brasil.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Info Alert */}
        <Alert className="mt-8">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Esta consulta utiliza a API pública DataJud do CNJ. Processos em segredo de
            justiça e dados protegidos pela LGPD não são exibidos.
          </AlertDescription>
        </Alert>

        {/* Process Details Sheet */}
        <ProcessDetailsSheet
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          process={selectedProcess?.process || null}
          tribunal={selectedProcess?.tribunal || null}
        />
      </div>
    </div>
  );
}
