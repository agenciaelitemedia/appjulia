/**
 * useSnoozeExpiryWatcher — observa as conversas adiadas ativas e avisa na
 * interface no momento em que o adiamento expira (a conversa volta sozinha
 * para a lista). Dispara um toast por conversa e chama `onExpired` para que
 * a lista/contadores sejam revalidados.
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { JuliaChatRowData } from '../api/types';

const CHECK_INTERVAL_MS = 15_000;

function labelOf(row: JuliaChatRowData) {
  return (
    row.contact_name ||
    row.lead_full_name ||
    row.phone ||
    'Conversa'
  );
}

export function useSnoozeExpiryWatcher(
  snoozedItems: JuliaChatRowData[],
  onExpired?: (rows: JuliaChatRowData[]) => void,
) {
  const trackedRef = useRef<Map<string, JuliaChatRowData>>(new Map());
  const notifiedRef = useRef<Set<string>>(new Set());
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  // mantém o "espelho" das adiadas ativas conhecidas
  useEffect(() => {
    const map = new Map<string, JuliaChatRowData>();
    for (const row of snoozedItems) {
      if (!row.conversation_id || !row.snoozed_until) continue;
      map.set(String(row.conversation_id), row);
      notifiedRef.current.delete(String(row.conversation_id));
    }
    trackedRef.current = map;
  }, [snoozedItems]);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const expired: JuliaChatRowData[] = [];
      trackedRef.current.forEach((row, id) => {
        const until = row.snoozed_until ? new Date(row.snoozed_until).getTime() : NaN;
        if (!Number.isFinite(until)) return;
        if (until <= now && !notifiedRef.current.has(id)) {
          notifiedRef.current.add(id);
          expired.push(row);
        }
      });
      if (expired.length === 0) return;

      for (const id of expired.map((r) => String(r.conversation_id))) {
        trackedRef.current.delete(id);
      }

      if (expired.length === 1) {
        toast.info(`Adiamento encerrado: ${labelOf(expired[0])}`, {
          description: 'A conversa voltou para a lista de atendimento.',
        });
      } else {
        toast.info(`${expired.length} conversas adiadas retornaram`, {
          description: 'Os adiamentos expiraram e elas voltaram para a lista.',
        });
      }

      onExpiredRef.current?.(expired);
    };

    check();
    const t = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);
}
