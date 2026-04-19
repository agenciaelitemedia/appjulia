import { Bot, MessageSquare, BarChart2, MessagesSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAIModelsConfig, type AIFeature } from '@/hooks/useAIModelsConfig';

const MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (rápido)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (preciso)' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'openai/gpt-4o', label: 'GPT-4o (premium)' },
];

interface FeatureCardProps {
  feature: AIFeature;
  icon: React.ReactNode;
  title: string;
  description: string;
  currentModel: string;
  onModelChange: (model: string) => void;
}

function FeatureCard({ feature, icon, title, description, currentModel, onModelChange }: FeatureCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={currentModel} onValueChange={onModelChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione um modelo" />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

export function AIModelsConfig() {
  const { isLoading, getModel, upsertModel } = useAIModelsConfig();

  const handleChange = (feature: AIFeature) => async (model: string) => {
    try {
      await upsertModel.mutateAsync({ feature, model });
      toast.success('Modelo atualizado');
    } catch {
      toast.error('Erro ao salvar modelo');
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <FeatureCard
        feature="chat_assist"
        icon={<MessageSquare className="w-4 h-4 text-blue-500" />}
        title="AIAssistPanel (Chat)"
        description="Resumo, sugestão de resposta e análise de sentimento nas conversas"
        currentModel={getModel('chat_assist')}
        onModelChange={handleChange('chat_assist')}
      />
      <FeatureCard
        feature="copilot_crm"
        icon={<BarChart2 className="w-4 h-4 text-green-500" />}
        title="Copiloto CRM (Monitor)"
        description="Análise automática de leads e oportunidades no monitor de CRM"
        currentModel={getModel('copilot_crm')}
        onModelChange={handleChange('copilot_crm')}
      />
      <FeatureCard
        feature="copilot_chat"
        icon={<MessagesSquare className="w-4 h-4 text-purple-500" />}
        title="Copiloto Chat Julia"
        description="Chat interativo sobre CRM, conversas e relatórios"
        currentModel={getModel('copilot_chat')}
        onModelChange={handleChange('copilot_chat')}
      />
    </div>
  );
}
