import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { getBrPhoneVariants } from '@/lib/phoneVariants';

export interface SessionPair {
  whatsappNumber: string;
  codAgent: string;
}

/**
 * Generate Brazilian phone variants including with/without country code 55
 * and with/without the extra mobile "9" digit.
 */
function allVariants(raw: string): string[] {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return [];
  const set = new Set<string>([d]);
  if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) {
    set.add('55' + d);
  }
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    set.add(d.slice(2));
  }
  for (const x of [...set]) {
    getBrPhoneVariants(x).forEach((v) => set.add(v));
  }
  return [...set].filter(Boolean);
}

/**
 * Batch fetch of agent session active flags for many (whatsapp, codAgent) pairs.
 * Returns Map<`${digits}:${codAgent}`, boolean> where the boolean is `active`.
 * Missing pairs are absent from the map (treat as no session => inactive).
 * The returned map is indexed by ALL phone variants (with/without 55, with/without 9)
 * so callers can lookup with the contact phone as-is.
 */
export function useAgentSessionStatusesBatch(pairs: SessionPair[]) {
  // Expand each input pair into all phone variants so the SQL IN-list matches
  // sessions stored in any of the legacy formats.
  const expanded: SessionPair[] = [];
  const seen = new Set<string>();
  for (const p of pairs) {
    const codAgent = String(p.codAgent || '');
    if (!codAgent) continue;
    for (const v of allVariants(p.whatsappNumber)) {
      const key = `${v}:${codAgent}`;
      if (seen.has(key)) continue;
      seen.add(key);
      expanded.push({ whatsappNumber: v, codAgent });
    }
  }
  const cleaned = expanded;

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
        const codAgent = String(r.cod_agent);
        const active = !!r.active;
        // Index by every variant of the returned whatsapp_number so a lookup
        // with any phone format finds the same session row.
        for (const v of allVariants(r.whatsapp_number)) {
          map.set(`${v}:${codAgent}`, active);
        }
      });
      return map;
    },
  });
}