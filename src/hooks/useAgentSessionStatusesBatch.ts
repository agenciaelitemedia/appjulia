import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { brPhoneVariants, normalizeBrPhone } from '@/lib/phoneNormalize';

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
      // Two passes to avoid order-dependent overwrites when the DB has BOTH
      // a 12-digit (legacy) and 13-digit (canonical) row for the same logical
      // number. We first collapse by canonical (`normalizeBrPhone`) and prefer
      // `active=true` (Julia ativa) — once any session reports active, treat
      // the conversation as Julia, not human override.
      const canonical = new Map<string, boolean>();
      (rows || []).forEach((r: any) => {
        const rawPhone = String(r.whatsapp_number || '').replace(/\D/g, '');
        const codAgent = String(r.cod_agent || '');
        if (!rawPhone || !codAgent) return;
        const canonPhone = normalizeBrPhone(rawPhone) || rawPhone;
        const key = `${canonPhone}:${codAgent}`;
        const incoming = !!r.active;
        const prev = canonical.get(key);
        // Prefer active=true over false when both forms exist
        canonical.set(key, prev === undefined ? incoming : prev || incoming);
      });
      // Now expand each canonical entry under all BR variants so consumers
      // looking up either 12 or 13 digit forms always hit the same value.
      canonical.forEach((active, key) => {
        const sep = key.lastIndexOf(':');
        const phone = key.slice(0, sep);
        const codAgent = key.slice(sep + 1);
        const variants = brPhoneVariants(phone);
        for (const v of variants) {
          map.set(`${v}:${codAgent}`, active);
        }
      });
      return map;
    },
  });
}