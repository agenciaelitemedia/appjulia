import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AIFeatureBillingAlert {
  /** Última falha 4xx do provedor (cobrança/autorização) nas últimas 24h. */
  reason: string | null;
  provider: string | null;
  at: string | null;
}

/**
 * Detecta se a feature de IA está sendo recusada pelo provedor por cobrança
 * (402) ou autorização (401/403) — o caso típico é a conta OpenRouter sem saldo.
 */
export function useAIFeatureBillingAlert(feature: string) {
  return useQuery({
    queryKey: ['ai-feature-billing-alert', feature],
    staleTime: 60_000,
    queryFn: async (): Promise<AIFeatureBillingAlert> => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await (supabase as any)
        .from('ai_usage_logs')
        .select('error_reason, provider, created_at')
        .eq('feature', feature)
        .eq('status', 'failed')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20);

      const hit = (data ?? []).find((r: any) =>
        ['ai_401', 'ai_402', 'ai_403'].includes(String(r?.error_reason ?? '')),
      );
      if (!hit) return { reason: null, provider: null, at: null };
      return {
        reason: String(hit.error_reason),
        provider: hit.provider ?? null,
        at: hit.created_at ?? null,
      };
    },
  });
}

export function billingAlertMessage(alert: AIFeatureBillingAlert): string | null {
  if (!alert.reason) return null;
  const p = alert.provider ? ` (${alert.provider})` : '';
  if (alert.reason === 'ai_402') {
    return `O provedor de IA${p} recusou as chamadas por falta de crédito. Reponha o saldo ou selecione um modelo Lovable AI.`;
  }
  return `A chave do provedor de IA${p} foi recusada (não autorizada). Atualize a chave ou selecione um modelo Lovable AI.`;
}
