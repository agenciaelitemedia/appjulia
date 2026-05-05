import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';

export interface SessionPair {
  whatsappNumber: string;
  codAgent: string;
}

/**
 * Batch fetch of agent session active flags for many (whatsapp, codAgent) pairs.
 * Returns Map<`${digits}:${codAgent}`, boolean> where the boolean is `active`.
 * Missing pairs are absent from the map (treat as no session => inactive).
 */
export function useAgentSessionStatusesBatch(pairs: SessionPair[]) {
  const cleaned = pairs
    .map((p) => ({
      whatsappNumber: String(p.whatsappNumber || '').replace(/\D/g, ''),
      codAgent: String(p.codAgent || ''),
    }))
    .filter((p) => p.whatsappNumber && p.codAgent);

  const dedupKey = Array.from(
    new Set(cleaned.map((p) => `${p.whatsappNumber}:${p.codAgent}`))
  ).sort().join(',');

  return useQuery({
    queryKey: ['agent-session-statuses-batch', dedupKey],
    enabled: cleaned.length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Map<string, boolean>> => {
      const map = new Map<string, boolean>();
      if (cleaned.length === 0) return map;
      const rows = await externalDb.getSessionStatusesBatch(cleaned);
      (rows || []).forEach((r: any) => {
        const key = `${String(r.whatsapp_number).replace(/\D/g, '')}:${String(r.cod_agent)}`;
        map.set(key, !!r.active);
      });
      return map;
    },
  });
}