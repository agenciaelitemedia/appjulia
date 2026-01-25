import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import type { AgentFormData } from '../CreateAgentWizard';

const DEFAULT_CONFIG = `{
  "greeting_message": "Olá! Como posso ajudar?",
  "max_response_time": 30,
  "auto_reply": true,
  "working_hours": {
    "start": "08:00",
    "end": "18:00"
  },
  "features": {
    "sentiment_analysis": true,
    "auto_categorization": true
  }
}`;

export function ConfigStep() {
  const { control, watch, setValue } = useFormContext<AgentFormData>();
  const configJson = watch('config_json');

  const isValidJson = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const handleLoadDefault = () => {
    setValue('config_json', DEFAULT_CONFIG);
  };

  const jsonValid = isValidJson(configJson);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Configurações Avançadas</h3>
        <p className="text-sm text-muted-foreground">
          Configure opções avançadas do agente em formato JSON
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          As configurações devem estar em formato JSON válido. 
          <button
            type="button"
            onClick={handleLoadDefault}
            className="ml-1 text-primary underline hover:no-underline"
          >
            Carregar exemplo
          </button>
        </AlertDescription>
      </Alert>

      <FormField
        control={control}
        name="config_json"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Configurações JSON</FormLabel>
            <FormControl>
              <Textarea
                placeholder="{\n  \n}"
                className="font-mono text-sm min-h-[300px] resize-y"
                {...field}
              />
            </FormControl>
            <FormDescription className="flex items-center gap-2">
              {configJson && configJson !== '{\n  \n}' && (
                <span className={jsonValid ? 'text-green-600' : 'text-destructive'}>
                  {jsonValid ? '✓ JSON válido' : '✗ JSON inválido'}
                </span>
              )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Config preview */}
      {jsonValid && configJson !== '{\n  \n}' && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="font-medium text-foreground mb-2">Prévia das Configurações</h4>
          <div className="text-sm text-muted-foreground">
            <pre className="whitespace-pre-wrap overflow-auto max-h-[200px]">
              {JSON.stringify(JSON.parse(configJson), null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
