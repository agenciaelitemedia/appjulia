// Central helper for activating/deactivating the Julia AI session.
//
// Every place in the UI that toggles session.active MUST go through
// toggleJuliaSession so we consistently:
//   - flip the `active` column in the external `sessions` table
//   - stop pending follow-ups when disabling (n8n_execute-followup-stop)
//   - reactivate agent + reschedule pre-followup when enabling
//     (n8n_execute-agent_and_followup-reactive)
//
// Edge function calls are best-effort: failures are logged as warnings and
// never bubble up so the UI toggle keeps working even if the follow-up
// backend is offline.

import { externalDb } from '@/lib/externalDb';
import { supabase } from '@/integrations/supabase/client';

export type HubFila = 'uazapi' | 'waba';

export interface ToggleJuliaSessionArgs {
  sessionId: number;
  /** Desired final state of session.active. */
  active: boolean;
  codAgent: string;
  /** Contact's WhatsApp number in any format — edges normalize it. */
  whatsappNumber: string;
  /** Queue hub type. Falls back to 'uazapi' when unknown. */
  hubFila?: HubFila | string | null;
}

function normalizeHubFila(value: ToggleJuliaSessionArgs['hubFila']): HubFila {
  return value === 'waba' ? 'waba' : 'uazapi';
}

export async function toggleJuliaSession(args: ToggleJuliaSessionArgs): Promise<void> {
  const { sessionId, active, codAgent, whatsappNumber } = args;
  const hubFila = normalizeHubFila(args.hubFila);
  const cleanPhone = String(whatsappNumber ?? '').replace(/\D/g, '');

  // 1) Direct flip on the external sessions table (source of truth for the badge).
  //    The reactive edge also runs this UPDATE, but keeping it here guarantees
  //    the UI state changes even if the edge call fails.
  await externalDb.updateSessionStatus(sessionId, active);

  if (!codAgent || !cleanPhone) return;

  if (active) {
    try {
      const { error } = await supabase.functions.invoke(
        'n8n_execute-agent_and_followup-reactive',
        { body: { codAgent, whatsappNumber: cleanPhone, hubFila } },
      );
      if (error) console.warn('[juliaSession] reactive falhou:', error);
    } catch (err) {
      console.warn('[juliaSession] reactive erro:', err);
    }
  } else {
    try {
      const { error } = await supabase.functions.invoke(
        'n8n_execute-followup-stop',
        { body: { codAgent, sessionId: cleanPhone } },
      );
      if (error) console.warn('[juliaSession] followup-stop falhou:', error);
    } catch (err) {
      console.warn('[juliaSession] followup-stop erro:', err);
    }
  }
}