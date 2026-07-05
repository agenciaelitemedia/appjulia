import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WavoipPlanFeatures {
  transcription: boolean;
  recordingSummary: boolean;
}

function hasFeature(features: unknown, key: string): boolean {
  if (!features) return false;
  if (Array.isArray(features)) return features.includes(key);
  if (typeof features === 'object') {
    const v = (features as Record<string, unknown>)[key];
    return v === true || v === 'true' || v === 1 || v === '1';
  }
  return false;
}

export function useWavoipClientPlanFeatures(clientId: number | null | undefined) {
  return useQuery({
    queryKey: ['wavoip-client-plan-features', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async (): Promise<WavoipPlanFeatures> => {
      const { data: up } = await (supabase as any)
        .from('wavoip_user_plans')
        .select('plan_id, is_active')
        .eq('client_id', clientId!)
        .eq('is_active', true)
        .order('activated_at', { ascending: false })
        .limit(1);
      const planId = up?.[0]?.plan_id;
      if (!planId) return { transcription: false, recordingSummary: false };
      const { data: plan } = await (supabase as any)
        .from('wavoip_plans')
        .select('features')
        .eq('id', planId)
        .maybeSingle();
      const f = plan?.features;
      return {
        transcription: hasFeature(f, 'transcription'),
        recordingSummary: hasFeature(f, 'recording_summary'),
      };
    },
  });
}