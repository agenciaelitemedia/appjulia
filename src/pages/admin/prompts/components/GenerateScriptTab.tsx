import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SaveCaseDialog } from './SaveCaseDialog';

export function GenerateScriptTab() {
  const [caseName, setCaseName] = useState('');
  const [customQuestions, setCustomQuestions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [caseInfo, setCaseInfo] = useState('');
  const [qualificationScript, setQualificationScript] = useState('');
  const [feesInfo, setFeesInfo] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const { toast } = useToast();

  const hasResult = caseInfo || qualificationScript || feesInfo;

  const handleGenerate = async () => {
    if (!caseName.trim()) {
      toast({ title: 'Atenção', description: 'Informe o nome do caso jurídico', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setCaseInfo('');
    setQualificationScript('');
    setFeesInfo('');

    try {
      const { data, error } = await supabase.functions.invoke('prompt-generator', {
        body: { case_name: caseName, custom_questions: customQuestions },
      });

      if (error) throw error;

      setCaseInfo(data.case_info || '');
      setQualificationScript(data.qualification_script || '');
      setFeesInfo(data.fees_info || '');
      toast({ title: 'Roteiro gerado!', description: 'Revise e edite os campos antes de salvar.' });
    } catch (err: any) {
      console.error('Erro ao gerar roteiro:', err);
      toast({ title: 'Erro', description: err.message || 'Falha ao gerar roteiro', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Roteiro
          </CardTitle>
          <CardDescription>
            Use IA para gerar roteiros de qualificação jurídica automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="caseName">Nome do Caso Jurídico *</Label>
            <Input
              id="caseName"
              placeholder="Ex: Auxílio-Acidente, Pensão por Morte, Aposentadoria Especial..."
              value={caseName}
              onChange={(e) => setCaseName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customQuestions">Perguntas Personalizadas (opcional)</Label>
            <Textarea
              id="customQuestions"
              placeholder={"Ex:\n- Trabalhou exposto a agente nocivo?\n- Por quanto tempo?\n- Tem PPP ou LTCAT?"}
              value={customQuestions}
              onChange={(e) => setCustomQuestions(e.target.value)}
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              Se não informar perguntas, a IA criará automaticamente com base na expertise jurídica.
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full sm:w-auto">
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando roteiro...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar Roteiro com IA
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {hasResult && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lista de Caso Jurídico</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={caseInfo}
                onChange={(e) => setCaseInfo(e.target.value)}
                className="min-h-[250px] font-mono text-sm bg-muted/30"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Roteiro de Qualificação</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={qualificationScript}
                onChange={(e) => setQualificationScript(e.target.value)}
                className="min-h-[400px] font-mono text-sm bg-muted/30"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Honorários do Caso</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={feesInfo}
                onChange={(e) => setFeesInfo(e.target.value)}
                className="min-h-[200px] font-mono text-sm bg-muted/30"
              />
            </CardContent>
          </Card>

          <Button onClick={() => setShowSaveDialog(true)} size="lg">
            <Save className="mr-2 h-4 w-4" />
            Gravar Caso Jurídico
          </Button>

          <SaveCaseDialog
            open={showSaveDialog}
            onOpenChange={setShowSaveDialog}
            caseName={caseName}
            caseInfo={caseInfo}
            qualificationScript={qualificationScript}
            feesInfo={feesInfo}
          />
        </div>
      )}
    </div>
  );
}
