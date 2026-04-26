/**
 * Versão Deno (Edge Functions) da normalização BR. Mantém paridade com
 * src/lib/phoneNormalize.ts.
 */
export function normalizeBrPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  let d = String(raw).replace(/@.*/, '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('055')) d = d.slice(1);
  if (d.startsWith('55') && d.length === 12) {
    const first = d[4];
    if (first === '6' || first === '7' || first === '8' || first === '9') {
      d = '55' + d.slice(2, 4) + '9' + d.slice(4);
    }
  }
  return d;
}

export function brPhoneVariants(raw: string | null | undefined): string[] {
  const norm = normalizeBrPhone(raw);
  if (!norm) return [];
  const set = new Set<string>([norm]);
  if (norm.startsWith('55') && norm.length === 13 && norm[4] === '9') {
    set.add('55' + norm.slice(2, 4) + norm.slice(5));
  }
  return Array.from(set);
}

export function toWhatsappLegacyJid(canonical: string): string {
  const d = (canonical || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length === 13 && d[4] === '9') {
    return '55' + d.slice(2, 4) + d.slice(5);
  }
  return d;
}
