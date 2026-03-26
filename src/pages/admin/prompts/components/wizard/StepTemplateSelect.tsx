import { Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTemplates, Template } from '../../hooks/useTemplates';

interface StepTemplateSelectProps {
  selectedId: string | null;
  onSelect: (template: Template) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepTemplateSelect({ selectedId, onSelect, onNext, onBack }: StepTemplateSelectProps) {
  const { templates, isLoading } = useTemplates();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Selecione o Template</h3>
        <p className="text-sm text-muted-foreground">Escolha o prompt base que será usado para este agente</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando templates...</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum template cadastrado. Crie um na aba Templates.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 max-h-[400px] overflow-y-auto">
          {templates.map(t => (
            <Card
              key={t.id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedId === t.id ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => onSelect(t)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">{t.name}</CardTitle>
                  {selectedId === t.id && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                </div>
                {t.description && <CardDescription className="text-xs line-clamp-2">{t.description}</CardDescription>}
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground font-mono line-clamp-3">{t.prompt_text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={onNext} disabled={!selectedId}>Próximo</Button>
      </div>
    </div>
  );
}
