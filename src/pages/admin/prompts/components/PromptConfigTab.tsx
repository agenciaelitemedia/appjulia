import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, RotateCcw, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_PROMPT_KEY = 'script_generator';

export function PromptConfigTab() {
  const [promptText, setPromptText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('generation_prompt_config')
      .select('prompt_text')
      .eq('config_key', DEFAULT_PROMPT_KEY)
      .single();

    if (data) {
      setPromptText((data as any).prompt_text);
      setOriginalText((data as any).prompt_text);
    }
    if (error) console.error('Erro ao carregar config:', error);
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('generation_prompt_config')
      .update({ prompt_text: promptText, updated_at: new Date().toISOString() } as any)
      .eq('config_key', DEFAULT_PROMPT_KEY);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar prompt', variant: 'destructive' });
    } else {
      setOriginalText(promptText);
      toast({ title: 'Sucesso', description: 'Prompt salvo com sucesso!' });
    }
    setIsSaving(false);
  };

  const handleRestore = () => {
    setPromptText(originalText);
    toast({ title: 'Restaurado', description: 'Prompt restaurado para a versão salva.' });
  };

  const hasChanges = promptText !== originalText;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Configuração do Prompt
        </CardTitle>
        <CardDescription>
          Edite o prompt mestre utilizado pela IA para gerar os roteiros de qualificação jurídica.
          Alterações aqui afetam todas as futuras gerações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Prompt do Sistema</Label>
          <Textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            className="min-h-[500px] font-mono text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Prompt
          </Button>
          <Button variant="outline" onClick={handleRestore} disabled={!hasChanges}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
