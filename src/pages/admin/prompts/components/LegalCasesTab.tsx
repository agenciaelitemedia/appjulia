import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, Eye, Plus, Loader2 } from 'lucide-react';
import { useLegalCases, CASE_CATEGORIES, type LegalCase } from '../hooks/useLegalCases';
import { SaveCaseDialog } from './SaveCaseDialog';

export function LegalCasesTab() {
  const { cases, isLoading, deleteCase } = useLegalCases();
  const [searchName, setSearchName] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<LegalCase | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  const filtered = cases.filter((c) => {
    const matchName = !searchName || c.case_name.toLowerCase().includes(searchName.toLowerCase());
    const matchCat = filterCategory === 'all' || c.category === filterCategory;
    return matchName && matchCat;
  });

  const categoryColor = (cat: string) => {
    if (cat.includes('PREVIDENCIÁRIO')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (cat.includes('TRABALHISTA')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    if (cat.includes('CONSUMIDOR')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (cat.includes('FAMÍLIA')) return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
    if (cat.includes('PENAL')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Todas categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CASE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Caso
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum caso jurídico encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedCase(c)}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">{c.case_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      {c.created_by && ` • ${c.created_by}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={categoryColor(c.category)}>{c.category}</Badge>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedCase(c); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteCase(c.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View/Edit Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCase?.case_name}</DialogTitle>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <Badge className={categoryColor(selectedCase.category)}>{selectedCase.category}</Badge>
              <div className="space-y-2">
                <Label className="font-semibold">Lista de Caso Jurídico</Label>
                <Textarea value={selectedCase.case_info || ''} readOnly className="min-h-[200px] font-mono text-xs bg-muted/30" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Roteiro de Qualificação</Label>
                <Textarea value={selectedCase.qualification_script || ''} readOnly className="min-h-[300px] font-mono text-xs bg-muted/30" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Honorários do Caso</Label>
                <Textarea value={selectedCase.fees_info || ''} readOnly className="min-h-[150px] font-mono text-xs bg-muted/30" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Case Dialog */}
      <SaveCaseDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        caseName=""
        caseInfo=""
        qualificationScript=""
        feesInfo=""
      />
    </div>
  );
}
