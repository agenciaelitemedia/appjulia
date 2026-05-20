import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Triggers an automatic conversation summary after a manual status change
 * (resolved / closed). The auto-summary is gated server-side by the agent's
 * AUTO_SUMMARY_ON_RESOLVE / AUTO_SUMMARY_ON_CLOSE flags; the client only fires
 * the request — failures are swallowed and never block the UI.
 *
 * Bulk closures do NOT call this hook by design.
 */
export function useAutoSummaryOnStatusChange() {
  const triggerAutoSummary = useCallback(
    async (
      conversationId: string,
      triggeredBy: 'auto_resolve' | 'auto_close',
    ): Promise<void> => {
      if (!conversationId) return;
      try {
        // Fire-and-forget. Do not await long enough to block UI.
        void supabase.functions.invoke('chat-ai-assist', {
          body: {
            mode: 'incremental_summary',
            conversation_id: conversationId,
            triggered_by: triggeredBy,
            insert_internal_note: true,
          },
        });
      } catch (err) {
        console.warn('[useAutoSummaryOnStatusChange] failed:', err);
      }
    },
    [],
  );

  return { triggerAutoSummary };
}