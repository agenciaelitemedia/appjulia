/**
 * Brazilian mobile phone variants helper.
 *
 * Many legacy systems stored cellphone numbers without the extra "9" that
 * was added by Anatel for mobile numbers (digit prefixes 6, 7, 8, 9). The
 * chat side normalizes numbers WITH the extra 9 (13 digits incl. country
 * code 55), while older CRM tables (e.g. `crm_atendimento_cards`) may have
 * stored them WITHOUT the 9 (12 digits).
 *
 * This helper returns every plausible variant of a Brazilian phone so the
 * caller can match both forms in a single query (e.g. `WHERE col = ANY($1)`).
 *
 * Rules:
 *  - Always returns the normalized (digits-only) input.
 *  - If 13 digits, starts with 55, 5th digit is "9" and 6th digit is in [6-9]
 *    -> also adds the 12-digit variant (drops the extra 9).
 *  - If 12 digits, starts with 55 and 5th digit is in [6-9]
 *    -> also adds the 13-digit variant (inserts a 9 after the DDD).
 *  - Other inputs are returned unchanged (no fake variants for landlines or
 *    non-BR numbers).
 */
export function getBrPhoneVariants(raw: string | null | undefined): string[] {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return [];
  const out = new Set<string>([d]);
  if (d.startsWith('55')) {
    const ddd = d.slice(2, 4);
    if (d.length === 13 && d[4] === '9' && /[6-9]/.test(d[5] ?? '')) {
      out.add(`55${ddd}${d.slice(5)}`); // remove extra 9
    } else if (d.length === 12 && /[6-9]/.test(d[4] ?? '')) {
      out.add(`55${ddd}9${d.slice(4)}`); // insert extra 9
    }
  }
  return [...out].filter(Boolean);
}
