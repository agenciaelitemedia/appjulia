import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AIFeature =
  | 'chat_assist'
  | 'copilot_crm'
  | 'copilot_chat'
  | 'chat_resume'
  | 'chat_transcription';

export interface AIModelConfig {
  id: string;
  client_id: string;
  feature: AIFeature;
  model: string;
  prompt: string | null;
  updated_at: string;
}

export const DEFAULT_MODELS: Record<AIFeature, string> = {
  chat_assist: 'google/gemini-2.5-flash',
  copilot_crm: 'google/gemini-2.5-flash',
  copilot_chat: 'google/gemini-2.5-flash',
  chat_resume: 'google/gemini-2.5-flash',
  chat_transcription: 'google/gemini-2.5-flash',
};

export const DEFAULT_PROMPTS: Record<AIFeature, string> = {
  chat_assist: '',
  copilot_crm: '',
  copilot_chat: '',
  chat_resume: `Você é um analista de atendimento. Gere um RESUMO OBJETIVO em português da conversa abaixo, priorizando os RELATOS DO CLIENTE (situação, dores, pedidos, dados pessoais relevantes ao caso). Mencione respostas do atendente APENAS quando forem indispensáveis para entender o caso (ex.: instrução crítica, compromisso assumido, encaminhamento). Use os resumos anteriores fornecidos como CONTEXTO acumulado; não os repita, apenas incorpore o que ainda for relevante. Saída em até 6 bullets curtos. Comece com 1 frase em negrito identificando o caso. Não invente informações.`,
  chat_transcription: `Você é um transcritor profissional em português (pt-BR). Transcreva o áudio com fidelidade, sem traduzir, sem resumir e sem comentários. Mantenha hesitações apenas se forem semanticamente relevantes. Retorne somente o texto transcrito.`,
};

export function useAIModelsConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const clientId = user?.client_id ? String(user.client_id) : null;

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['ai-model-config', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_ai_model_config')
        .select('*')
        .eq('client_id', clientId!);
      if (error) throw error;
      return (data || []) as AIModelConfig[];
    },
  });

  const upsertModel = useMutation({
    mutationFn: async ({
      feature,
      model,
      prompt,
    }: { feature: AIFeature; model?: string; prompt?: string | null }) => {
      const existing = configs.find((c) => c.feature === feature);
      const payload = {
        client_id: clientId!,
        feature,
        model: model ?? existing?.model ?? DEFAULT_MODELS[feature],
        prompt: prompt !== undefined ? prompt : existing?.prompt ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('client_ai_model_config')
        .upsert(payload, { onConflict: 'client_id,feature' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-model-config', clientId] });
    },
  });

  const getModel = (feature: AIFeature): string => {
    return configs.find((c) => c.feature === feature)?.model ?? DEFAULT_MODELS[feature];
  };

  const getPrompt = (feature: AIFeature): string => {
    const stored = configs.find((c) => c.feature === feature)?.prompt;
    return (stored ?? '').trim().length > 0 ? (stored as string) : DEFAULT_PROMPTS[feature];
  };

  return { configs, isLoading, upsertModel, getModel, getPrompt };
}
