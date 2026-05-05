import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { getBrPhoneVariants } from '@/lib/phoneVariants';

export interface PhoneStageInfo {
  stageId: number;
  stageName?: string;
  stageColor?: string;
}

/**
 * Maps chat contact phone numbers to their CRM stage from `crm_atendimento_cards`.
 * Refreshes every 60s. Returns a Map<phone, PhoneStageInfo>.
 */
export function useCRMStageByPhone(phones: string[]) {
  // Normalize + dedupe phones (including BR 9-digit variants) to keep cache key stable
  const normalizedInput = phones.filter(Boolean).map((p) => p.replace(/\D/g, ''));
  const expanded = Array.from(
    new Set(normalizedInput.flatMap((p) => getBrPhoneVariants(p)))
  ).sort();
  const normalized = expanded;

  return useQuery({
    queryKey: ['crm-stage-by-phone', normalized],
    queryFn: async () => {
      const map = new Map<string, PhoneStageInfo>();
      if (normalized.length === 0) return map;

      const rows = await externalDb.raw<{
        whatsapp_number: string;
        stage_id: number;
        stage_name: string | null;
        stage_color: string | null;
      }>({
        query: `
          SELECT DISTINCT ON (c.whatsapp_number)
            c.whatsapp_number, c.stage_id,
            s.name as stage_name, s.color as stage_color
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
          WHERE c.whatsapp_number = ANY($1::varchar[])
          ORDER BY c.whatsapp_number, c.updated_at DESC NULLS LAST
        `,
        params: [normalized],
      });

      rows.forEach((r) => {
        const stored = String(r.whatsapp_number);
        const info = {
          stageId: Number(r.stage_id),
          stageName: r.stage_name ?? undefined,
          stageColor: r.stage_color ?? undefined,
        };
        // Map every variant of this number back to the same info, so callers
        // looking up by either 12 or 13 digit form will hit it.
        getBrPhoneVariants(stored).forEach((v) => map.set(v, info));
        map.set(stored, info);
      });
      return map;
    },
    enabled: normalized.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}