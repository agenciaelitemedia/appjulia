import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { getBrPhoneVariants } from '@/lib/phoneVariants';

export type SessionPhonesMode = 'julia' | 'human';

/**
 * Fetch the universe of phones whose latest session matches the given mode:
 *  - 'julia' → sessions with active = true
 *  - 'human' → sessions with active = false (paused / human override)
 *
 * Used by ChatList to apply the mode filter server-side via `phone IN (...)`,
 * so the totalizers and pagination cover the whole base, not just the
 * already-loaded page.
 *
 * Phone variants (with/without 55, with/without 9th digit) are expanded so
 * that `chat_contacts.phone` can match no matter which legacy format was
 * stored.
 */
export function useSessionPhonesByMode(
  mode: SessionPhonesMode | 'all' | 'unknown',
  codAgents: string[],
  enabledOverride = true
) {
  const enabled =
    enabledOverride &&
    (mode === 'julia' || mode === 'human') &&
    codAgents.length > 0;

  const codesKey = [...new Set(codAgents.map(String))].sort().join(',');

  return useQuery({
    queryKey: ['session-phones-by-mode', mode, codesKey],
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const active = mode === 'julia';
      const rows = await externalDb.getSessionPhonesByActive(
        codAgents,
        active,
        5000
      );
      const set = new Set<string>();
      for (const r of rows || []) {
        const raw = String(r.whatsapp_number || '').replace(/\D/g, '');
        if (!raw) continue;
        set.add(raw);
        for (const v of getBrPhoneVariants(raw)) set.add(v);
        // Also try variants on the un-prefixed national number.
        if (raw.startsWith('55') && (raw.length === 12 || raw.length === 13)) {
          const local = raw.slice(2);
          set.add(local);
          for (const v of getBrPhoneVariants(local)) set.add(v);
        } else if (!raw.startsWith('55') && (raw.length === 10 || raw.length === 11)) {
          const intl = '55' + raw;
          set.add(intl);
          for (const v of getBrPhoneVariants(intl)) set.add(v);
        }
      }
      const phones = [...set];
      const exceededLimit = (rows?.length ?? 0) >= 5000;
      return { phones, exceededLimit };
    },
  });
}