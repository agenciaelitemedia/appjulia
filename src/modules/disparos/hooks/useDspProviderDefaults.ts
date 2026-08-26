import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import type { DspProviderDefaults } from '../types';
import { DSP_OFFICIAL_DEFAULTS, DSP_UNOFFICIAL_DEFAULTS, validateLimits } from './useDspLimits';

export type DspProvider = 'uazapi' | 'meta_cloud';

export function providerFallback(provider: DspProvider) {
  return provider === 'uazapi' ? DSP_UNOFFICIAL_DEFAULTS : DSP_OFFICIAL_DEFAULTS;
}

/** Padrões seguros do escritório, um por tipo de API. Fonte da verdade dos limites. */
export function useDspProviderDefaults(clientId: string | null) {
  return useQuery<DspProviderDefaults[]>({
    queryKey: ['disparos', 'provider-defaults', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dsp_provider_defaults')
        .select('*')
        .eq('client_id', String(clientId));
      if (error) throw error;
      return (data ?? []) as DspProviderDefaults[];
    },
  });
}

export function useSaveDspProviderDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<DspProviderDefaults> & { client_id: string; provider: DspProvider },
    ) => {
      const errors = validateLimits(input as any, input.provider === 'uazapi');
      if (errors.length > 0) throw new Error(errors.join(' '));

      const { data: existing } = await (supabase as any)
        .from('dsp_provider_defaults')
        .select('id')
        .eq('client_id', String(input.client_id))
        .eq('provider', input.provider)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await (supabase as any)
          .from('dsp_provider_defaults').update(input).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('dsp_provider_defaults').insert(input);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disparos', 'provider-defaults'] });
      toast.success('Padrão seguro salvo — vale para todos os canais deste tipo');
    },
    onError: (e: any) => toast.error('Não foi possível salvar', { description: e?.message }),
  });
}
