import { useState } from 'react';
import { MessageSquare, BarChart2, MessagesSquare, FileText, AudioLines, Pencil, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAIModelsConfig, type AIFeature, DEFAULT_PROMPTS } from '@/hooks/useAIModelsConfig';

const MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (rápido)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (preciso)' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'openai/gpt-4o', label: 'GPT-4o (premium)' },
];

const FEATURES_WITH_PROMPT: AIFeature[] = ['chat_resume', 'chat_transcription'];

interface FeatureCardProps {
  feature: AIFeature;
  icon: React.ReactNode;
  title: string;
  description: string;
  currentModel: string;
  onModelChange: (model: string) => void;
  currentPrompt?: string;
  onPromptSave?: (prompt: string | null) => Promise<void>;
}

function FeatureCard({ feature, icon, title, description, currentModel, onModelChange, currentPrompt, onPromptSave }: FeatureCardProps) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [draft, setDraft] = useState(currentPrompt ?? '');
  const [saving, setSaving] = useState(false);

  const openDialog = () => {
    setDraft(currentPrompt ?? DEFAULT_PROMPTS[feature]);
    setPromptOpen(true);
  };

  const handleSave = async () => {
    if (!onPromptSave) return;
    setSaving(true);
    try {
      await onPromptSave(draft.trim() ? draft : null);
      toast.success('Prompt salvo');
      setPromptOpen(false);
    } catch {
      toast.error('Erro ao salvar prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = () => {
    setDraft(DEFAULT_PROMPTS[feature]);
  };

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
        <div className="flex items-center gap-2">
          <Select value={currentModel} onValueChange={onModelChange}>
            <SelectTrigger className="flex-1">
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
          {onPromptSave && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Editar prompt"
              onClick={openDialog}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>

      {onPromptSave && (
        <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                Editar prompt — {title}
              </DialogTitle>
              <DialogDescription>
                Personalize o prompt enviado ao modelo. Deixe em branco para usar o padrão do sistema.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[260px] font-mono text-xs"
              placeholder={DEFAULT_PROMPTS[feature]}
            />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={handleRestore} disabled={saving}>
                <RotateCcw className="w-4 h-4 mr-1" /> Restaurar padrão
              </Button>
              <Button type="button" variant="outline" onClick={() => setPromptOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

export function AIModelsConfig() {
  const { isLoading, getModel, getPrompt, upsertModel } = useAIModelsConfig();

  const handleChange = (feature: AIFeature) => async (model: string) => {
    try {
      await upsertModel.mutateAsync({ feature, model });
      toast.success('Modelo atualizado');
    } catch {
      toast.error('Erro ao salvar modelo');
    }
  };

  const handlePromptSave = (feature: AIFeature) => async (prompt: string | null) => {
    await upsertModel.mutateAsync({ feature, prompt });
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5].map((i) => (
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
      <FeatureCard
        feature="chat_resume"
        icon={<FileText className="w-4 h-4 text-amber-500" />}
        title="Resumo de Conversa"
        description="Gera resumo automático ao resolver/encerrar conversa e em ações manuais"
        currentModel={getModel('chat_resume')}
        onModelChange={handleChange('chat_resume')}
        currentPrompt={getPrompt('chat_resume')}
        onPromptSave={handlePromptSave('chat_resume')}
      />
      <FeatureCard
        feature="chat_transcription"
        icon={<AudioLines className="w-4 h-4 text-cyan-500" />}
        title="Transcrição de Áudio"
        description="Transcreve áudios recebidos e enviados nas conversas"
        currentModel={getModel('chat_transcription')}
        onModelChange={handleChange('chat_transcription')}
        currentPrompt={getPrompt('chat_transcription')}
        onPromptSave={handlePromptSave('chat_transcription')}
      />
    </div>
  );
}
