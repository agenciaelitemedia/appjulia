import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lightbulb } from 'lucide-react';
import type { AgentFormData } from '../CreateAgentWizard';

const PROMPT_TIPS = [
  'Defina a personalidade e tom de voz do agente',
  'Especifique as áreas de conhecimento do agente',
  'Inclua instruções de como lidar com situações específicas',
  'Defina limites do que o agente pode ou não fazer',
];

const EXAMPLE_PROMPT = `Você é a Julia, uma assistente virtual especializada em atendimento jurídico. 

## Personalidade
- Profissional e cordial
- Objetiva nas respostas
- Empática com as necessidades dos clientes

## Conhecimento
- Direito trabalhista
- Direito civil
- Processo judicial

## Instruções
1. Sempre cumprimente o cliente pelo nome quando disponível
2. Faça perguntas para entender melhor o caso
3. Nunca forneça aconselhamento jurídico definitivo
4. Encaminhe para um advogado quando necessário

## Limitações
- Não faça diagnósticos legais
- Não prometa resultados em processos
- Não discuta valores de honorários`;

export function PromptStep() {
  const { control, setValue, watch } = useFormContext<AgentFormData>();
  const currentPrompt = watch('system_prompt');

  const handleLoadExample = () => {
    setValue('system_prompt', EXAMPLE_PROMPT);
  };

  const wordCount = currentPrompt?.split(/\s+/).filter(Boolean).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Prompt do Sistema</h3>
        <p className="text-sm text-muted-foreground">
          Defina as instruções de personalidade e comportamento do agente IA
        </p>
      </div>

      <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-2">Dicas para um bom prompt:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {PROMPT_TIPS.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleLoadExample}
            className="mt-2 text-primary underline hover:no-underline"
          >
            Carregar exemplo de prompt
          </button>
        </AlertDescription>
      </Alert>

      <FormField
        control={control}
        name="system_prompt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Prompt do Sistema *</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Você é um assistente virtual especializado em..."
                className="min-h-[400px] resize-y"
                {...field}
              />
            </FormControl>
            <FormDescription className="flex items-center justify-between">
              <span>
                Instruções detalhadas de como o agente deve se comportar
              </span>
              <span className="text-muted-foreground">
                {wordCount} palavras
              </span>
            </FormDescription>
          </FormItem>
        )}
      />
    </div>
  );
}
