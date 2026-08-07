/**
 * Configuração de provedores (LLM e voz) do X-Julia.
 * Chaves são write-only: o front só recebe status mascarado.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';

export interface XJProviderSetting {
  provider: string;
  kind: 'llm' | 'voice';
  is_enabled: boolean;
  enabled_models: string[];
  default_key_masked: string | null;
}

export interface XJClientKeyStatus {
  provider: string;
  kind: 'llm' | 'voice';
  masked: string | null;
}

interface XJProviderConfigResponse {
  providers: XJProviderSetting[];
  client_keys: XJClientKeyStatus[];
}

const KEY = ['x-julia', 'provider-config'];

export function useXJProviderConfig(clientId?: string | null) {
  return useQuery<XJProviderConfigResponse>({
    queryKey: [...KEY, clientId ?? 'global'],
    staleTime: 60_000,
    queryFn: async () => {
      const path = clientId
        ? `xj-provider-config?client_id=${encodeURIComponent(String(clientId))}`
        : 'xj-provider-config';
      const { data, error } = await supabase.functions.invoke(path, { method: 'GET' });
      if (error) return { providers: [], client_keys: [] };
      return (data as XJProviderConfigResponse) ?? { providers: [], client_keys: [] };
    },
  });
}

export function useXJProviderConfigMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const saveProvider = useMutation({
    mutationFn: async (input: {
      provider: string;
      kind: 'llm' | 'voice';
      is_enabled: boolean;
      enabled_models: string[];
      default_key?: string;
    }) => {
      const { error } = await supabase.functions.invoke('xj-provider-config', {
        method: 'POST',
        body: { action: 'save_provider', ...input },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Provedor atualizado');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar provedor'),
  });

  const saveClientKey = useMutation({
    mutationFn: async (input: {
      client_id: string;
      provider: string;
      kind: 'llm' | 'voice';
      api_key: string;
    }) => {
      const { error } = await supabase.functions.invoke('xj-provider-config', {
        method: 'POST',
        body: { action: 'save_client_key', ...input },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Chave do escritório salva');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar chave'),
  });

  return { saveProvider, saveClientKey };
}