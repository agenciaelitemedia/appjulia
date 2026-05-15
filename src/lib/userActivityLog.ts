import { supabase } from '@/integrations/supabase/client';

export type UserActivityEvent = 'login' | 'logout_manual' | 'logout_inactivity';

export interface LogParams {
  userId: number;
  userName?: string | null;
  clientId?: number | null;
  eventType: UserActivityEvent;
}

/**
 * Persiste um evento de login/logout em `user_activity_log`.
 * Falha silenciosamente — auditoria nunca deve quebrar o fluxo de auth.
 */
export async function logUserActivity(params: LogParams): Promise<void> {
  try {
    await supabase.from('user_activity_log').insert({
      user_id: params.userId,
      user_name: params.userName ?? null,
      client_id: params.clientId ?? null,
      event_type: params.eventType,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch (err) {
    console.warn('[userActivityLog] failed', err);
  }
}