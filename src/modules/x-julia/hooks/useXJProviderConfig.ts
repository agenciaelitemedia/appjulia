/**
 * Configuração de provedores (LLM e voz) do X-Julia.
 * Chaves são write-only: o front só recebe status mascarado.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { applyXJPricingOverrides } from '../modelCatalog';

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

export interface XJModelPricingRow {
  id?: string;
  provider: string;
  model: string;
  input_per_1m: number;
  output_per_1m: number;
  context_tokens: number;
  note: string | null;
  is_active: boolean;
  updated_at?: string;
}

export interface XJRemoteModel {
  model: string;
  input_per_1m?: number | null;
  output_per_1m?: number | null;
  context_tokens?: number | null;
  note?: string | null;
}

interface XJProviderConfigResponse {
  providers: XJProviderSetting[];
  client_keys: XJClientKeyStatus[];
  model_pricing?: XJModelPricingRow[];
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
      if (error) return { providers: [], client_keys: [], model_pricing: [] };
      const parsed = (data as XJProviderConfigResponse) ?? { providers: [], client_keys: [], model_pricing: [] };
      applyXJPricingOverrides(parsed.model_pricing ?? []);
      return parsed;
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

export function useXJModelPricingMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const savePricing = useMutation({
    mutationFn: async (input: {
      provider: string;
      model: string;
      input_per_1m: number;
      output_per_1m: number;
      context_tokens: number;
      note?: string | null;
      is_active?: boolean;
    }) => {
      const { error } = await supabase.functions.invoke('xj-provider-config', {
        method: 'POST',
        body: { action: 'save_model_pricing', ...input },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Modelo salvo');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar modelo'),
  });

  const deletePricing = useMutation({
    mutationFn: async (input: { provider: string; model: string }) => {
      const { error } = await supabase.functions.invoke('xj-provider-config', {
        method: 'POST',
        body: { action: 'delete_model_pricing', ...input },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Modelo removido do catálogo');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover modelo'),
  });

  const seedPricing = useMutation({
    mutationFn: async (input?: { force?: boolean }) => {
      const { error } = await supabase.functions.invoke('xj-provider-config', {
        method: 'POST',
        body: { action: 'seed_model_pricing', force: !!input?.force },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Catálogo padrão importado');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao importar catálogo'),
  });

  const fetchProviderModels = useMutation<XJRemoteModel[], any, { provider: string; client_id?: string | null }>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke('xj-provider-config', {
        method: 'POST',
        body: { action: 'list_provider_models', ...input },
      });
      if (error) {
        const detail = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(detail?.error || error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return ((data as any)?.models ?? []) as XJRemoteModel[];
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao buscar modelos do provedor'),
  });

  const importProviderModels = useMutation({
    mutationFn: async (input: { provider: string; models: XJRemoteModel[] }) => {
      const { data, error } = await supabase.functions.invoke('xj-provider-config', {
        method: 'POST',
        body: { action: 'import_provider_models', ...input },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any)?.imported ?? 0;
    },
    onSuccess: (count) => {
      invalidate();
      toast.success(`${count} modelo(s) importado(s) do provedor`);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao importar modelos'),
  });

  return { savePricing, deletePricing, seedPricing, fetchProviderModels, importProviderModels };
}