import { useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { processFinalPrompt } from '../../constants/promptDefaults';
import { CaseData } from './CaseCustomizeDialog';

interface StepFinalPromptProps {
  templatePromptText: string;
  aiConfig: {
    aiName: string;
    practiceAreas: string;
    workingHours: string;
    officeInfo: string;
    welcomeMessage: string;
  };
  cases: CaseData[];
  onBack: () => void;
  onSave: (generatedPrompt: string) => void;
  saving: boolean;
}

export function StepFinalPrompt({ templatePromptText, aiConfig, cases, onBack, onSave, saving }: StepFinalPromptProps) {
  const [copied, setCopied] = useState(false);

  const generatedPrompt = useMemo(() => {
    return processFinalPrompt(templatePromptText, aiConfig, cases);
  }, [templatePromptText, aiConfig, cases]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Prompt Final</h3>
          <p className="text-sm text-muted-foreground">Revise o prompt gerado com todas as substituições</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </Button>
      </div>

      <div className="flex-1">
        <Textarea
          value={generatedPrompt}
          readOnly
          className="min-h-[500px] h-full font-mono text-sm bg-muted resize-none"
        />
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={() => onSave(generatedPrompt)} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Prompt'}
        </Button>
      </div>
    </div>
  );
}
