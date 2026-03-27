import { useState } from 'react';
import { Search, Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { CaseCustomizeDialog, CaseData } from './CaseCustomizeDialog';
import { DEFAULT_CONTRACT_FIELDS, DEFAULT_ZAPSIGN_TOKEN, DEFAULT_FEES_TEXT } from '../../constants/promptDefaults';

interface StepCaseSelectProps {
  cases: CaseData[];
  onChange: (cases: CaseData[]) => void;
  templateClosingModel: string;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
}

interface LegalCase {
  id: string;
  case_name: string;
  category: string;
  case_info: string | null;
  qualification_script: string | null;
  fees_info: string | null;
}

export function StepCaseSelect({ cases, onChange, templateClosingModel, onBack, onSave, saving }: StepCaseSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<LegalCase[]>([]);
  const [searching, setSearching] = useState(false);
  const [customizing, setCustomizing] = useState<CaseData | null>(null);
  const [viewing, setViewing] = useState<CaseData | null>(null);

  const searchCases = async (term: string) => {
    if (term.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('generation_legal_cases')
      .select('id, case_name, category, case_info, qualification_script, fees_info')
      .eq('is_active', true)
      .ilike('case_name', `%${term}%`)
      .limit(10);
    setSearchResults((data as LegalCase[]) || []);
    setSearching(false);
  };

  const extractKeywords = (text: string, caseName: string): string => {
    if (!text) return '';
    const stopwords = new Set([
      'de','do','da','dos','das','em','no','na','nos','nas','um','uma','uns','umas',
      'o','a','os','as','e','ou','que','para','por','com','se','ao','à','pelo','pela',
      'são','ser','ter','foi','está','como','mais','mas','não','sim','já','também',
      'esse','essa','este','esta','isso','aquilo','ele','ela','eles','elas','seu','sua',
      'seus','suas','qual','quais','quando','onde','pode','deve','caso','sobre','entre',
      'até','sem','após','durante','cada','todo','toda','todos','todas','outro','outra',
      'outros','outras','mesmo','mesma','muito','muita','muitos','muitas','bem','ainda',
    ]);
    const words = text
      .replace(/[^a-záàâãéèêíïóôõöúçñ\s-]/gi, ' ')
      .split(/\s+/)
      .map(w => w.toLowerCase().trim())
      .filter(w => w.length > 3 && !stopwords.has(w));
    const freq = new Map<string, number>();
    words.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5).map(([w]) => `"${w}"`);
    return top5.length > 0 ? `${top5.join(', ')} → ${caseName}` : '';
  };

  const addCase = (legalCase: LegalCase) => {
    if (cases.some(c => c.case_id === legalCase.id)) return;
    const semanticWords = extractKeywords(legalCase.case_info || '', legalCase.case_name);
    const newCase: CaseData = {
      case_id: legalCase.id,
      case_name: legalCase.case_name,
      ctas: [],
      semantic_words: semanticWords,
      case_info: legalCase.case_info || '',
      qualification_script: legalCase.qualification_script || '',
      zapsign_token: DEFAULT_ZAPSIGN_TOKEN,
      zapsign_doc_token: '',
      contract_fields: DEFAULT_CONTRACT_FIELDS,
      fees_text: legalCase.fees_info || DEFAULT_FEES_TEXT,
      closing_model_text: templateClosingModel,
      negotiation_text: '',
      position: cases.length,
    };
    onChange([...cases, newCase]);
    setSearchTerm('');
    setSearchResults([]);
  };

  const removeCase = (caseId: string) => {
    onChange(cases.filter(c => c.case_id !== caseId));
  };

  const updateCase = (updatedCase: CaseData) => {
    onChange(cases.map(c => c.case_id === updatedCase.case_id ? updatedCase : c));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Casos do Agente</h3>
        <p className="text-sm text-muted-foreground">Busque e adicione casos jurídicos, depois personalize cada um</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar caso jurídico..."
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); searchCases(e.target.value); }}
          className="pl-10"
        />
      </div>

      {searching && <p className="text-sm text-muted-foreground text-center">Buscando...</p>}

      {searchResults.length > 0 && (
        <div className="space-y-1 max-h-[200px] overflow-y-auto border rounded-md p-2">
          {searchResults.map(r => {
            const alreadyAdded = cases.some(c => c.case_id === r.id);
            return (
              <div
                key={r.id}
                className={`flex items-center justify-between p-2 rounded hover:bg-muted/50 ${alreadyAdded ? 'opacity-50' : 'cursor-pointer'}`}
                onClick={() => !alreadyAdded && addCase(r)}
              >
                <div>
                  <p className="text-sm font-medium">{r.case_name}</p>
                  <p className="text-xs text-muted-foreground">{r.category}</p>
                </div>
                {!alreadyAdded && <Plus className="h-4 w-4 text-primary" />}
              </div>
            );
          })}
        </div>
      )}

      {cases.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Casos adicionados ({cases.length})</Label>
          {cases.map(c => (
            <Card key={c.case_id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.case_name}</p>
                  {c.ctas.length > 0 && (
                    <p className="text-xs text-muted-foreground">{c.ctas.length} CTA(s)</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(c)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Personalizar" onClick={() => setCustomizing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Remover" onClick={() => removeCase(c.case_id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={onSave}>Próximo</Button>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={o => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.case_name}</DialogTitle>
            <DialogDescription>Visualização do caso</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Informações do Caso</Label>
              <Textarea value={viewing?.case_info || ''} readOnly className="min-h-[100px] font-mono text-sm bg-muted" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Roteiro de Qualificação</Label>
              <Textarea value={viewing?.qualification_script || ''} readOnly className="min-h-[100px] font-mono text-sm bg-muted" />
            </div>
            {viewing?.negotiation_text && (
              <div>
                <Label className="text-xs font-semibold">Informações de Negociação (processado)</Label>
                <Textarea value={viewing.negotiation_text} readOnly className="min-h-[100px] font-mono text-sm bg-muted" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Customize Dialog */}
      <CaseCustomizeDialog
        open={!!customizing}
        onOpenChange={o => !o && setCustomizing(null)}
        caseData={customizing}
        onSave={updateCase}
        templateClosingModel={templateClosingModel}
      />
    </div>
  );
}
