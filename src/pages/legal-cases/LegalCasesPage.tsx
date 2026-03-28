import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Scale, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLegalCases, LegalCase, CASE_CATEGORIES } from '@/pages/admin/prompts/hooks/useLegalCases';

const CATEGORY_COLORS: Record<string, string> = {
  'Digital': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'Direito Civil': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Direito de Família': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  'Direito do Consumidor': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'Direito Imobiliário': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'Direito Previdenciário': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Direito Trabalhista': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'Direito Tributário': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  'Empresarial': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
};

export default function LegalCasesPage() {
  const { cases, isLoading } = useLegalCases();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<LegalCase | null>(null);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cases) {
      counts[c.category] = (counts[c.category] || 0) + 1;
    }
    return counts;
  }, [cases]);

  const filteredCases = useMemo(() => {
    let result = cases;
    if (selectedCategory !== 'all') {
      result = result.filter(c => c.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.case_name.toLowerCase().includes(q));
    }
    return result;
  }, [cases, selectedCategory, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Scale className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Casos Jurídicos</h1>
        <Badge variant="secondary" className="ml-2">{cases.length} casos</Badge>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome do caso..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category counters */}
      <div className="flex flex-wrap gap-2">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedCategory === 'all'
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : ''
          }`}
          onClick={() => setSelectedCategory('all')}
        >
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold">{cases.length}</p>
            <p className="text-xs text-muted-foreground whitespace-nowrap">Todos</p>
          </CardContent>
        </Card>

        {CASE_CATEGORIES.map(cat => {
          const count = categoryCounts[cat] || 0;
          if (count === 0) return null;
          return (
            <Card
              key={cat}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedCategory === cat
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : ''
              }`}
              onClick={() => setSelectedCategory(cat)}
            >
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground whitespace-nowrap">{cat}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cases grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCases.map(legalCase => (
          <Card
            key={legalCase.id}
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
            onClick={() => setSelectedCase(legalCase)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm leading-tight">{legalCase.case_name}</h3>
              </div>
              <Badge className={`text-[10px] ${CATEGORY_COLORS[legalCase.category] || ''}`} variant="outline">
                {legalCase.category}
              </Badge>
              {legalCase.case_info && (
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {legalCase.case_info}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCases.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum caso encontrado.
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!selectedCase} onOpenChange={open => !open && setSelectedCase(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedCase && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedCase.case_name}
                  <Badge className={`text-xs ${CATEGORY_COLORS[selectedCase.category] || ''}`} variant="outline">
                    {selectedCase.category}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {selectedCase.case_info && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Informações do Caso</label>
                    <Textarea
                      readOnly
                      value={selectedCase.case_info}
                      className="mt-1 font-mono text-xs min-h-[120px] resize-none bg-muted/30"
                    />
                  </div>
                )}

                {selectedCase.qualification_script && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Roteiro de Qualificação</label>
                    <Textarea
                      readOnly
                      value={selectedCase.qualification_script}
                      className="mt-1 font-mono text-xs min-h-[150px] resize-none bg-muted/30"
                    />
                  </div>
                )}

                {selectedCase.fees_info && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Honorários</label>
                    <Textarea
                      readOnly
                      value={selectedCase.fees_info}
                      className="mt-1 font-mono text-xs min-h-[100px] resize-none bg-muted/30"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
