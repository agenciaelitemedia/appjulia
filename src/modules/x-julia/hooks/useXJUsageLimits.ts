/**
 * Limites de custo/mensagens do X-Julia (FinOps) e consumo do escritório.
 * Leitura e gravação sempre pelo servidor (x-julia-admin), com identidade do app.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { xjInvoke } from '../lib/xjInvoke';

export interface XJUsageLimits {
  client_id: string;
  daily_cost_usd: number;
  monthly_cost_usd: number;
  max_msgs_per_hour_per_lead: number;
  max_msgs_per_hour_per_client: number;
  on_breach: 'notify_only' | 'pause';
  breach_message: string;
  is_active: boolean;
}

export interface XJUsageSnapshot {
  day_cost_usd: number;
  day_turns: number;
  month_cost_usd: number;
  month_turns: number;
}

export interface XJPausedSession {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  paused_at: string | null;
  paused_reason: string | null;
}

interface XJUsageResponse {
  client_id: string;
  limits: XJUsageLimits | null;
  usage: XJUsageSnapshot | null;
  paused_sessions: XJPausedSession[];
}

const KEY = ['x-julia', 'usage'];

export function useXJUsage(clientId?: string | null) {
  return useQuery<XJUsageResponse>({
    queryKey: [...KEY, clientId ?? 'self'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await xjInvoke<XJUsageResponse & { error?: string }>('x-julia-admin', {
        body: { action: 'usage_get', data: clientId ? { client_id: String(clientId) } : {} },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return {
        client_id: data?.client_id ?? '',
        limits: data?.limits ?? null,
        usage: data?.usage ?? null,
        paused_sessions: data?.paused_sessions ?? [],
      };
    },
  });
}

export function useXJUsageMutations(clientId?: string | null) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const saveLimits = useMutation({
    mutationFn: async (payload: Partial<XJUsageLimits>) => {
      const { data, error } = await xjInvoke<{ error?: string }>('x-julia-admin', {
        body: {
          action: 'usage_limits_save',
          data: { ...payload, ...(clientId ? { client_id: String(clientId) } : {}) },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Limites salvos');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || 'Falha ao salvar limites'),
  });

  const resumeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await xjInvoke<{ error?: string }>('x-julia-admin', {
        body: { action: 'usage_resume_session', data: { session_id: sessionId } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Atendimento retomado');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || 'Falha ao retomar'),
  });

  return { saveLimits, resumeSession };
}
