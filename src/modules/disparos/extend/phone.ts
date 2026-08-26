/**
 * extend/phone — normalização E.164 reutilizada da Julia.
 */
export { normalizeBrPhone, brPhoneVariants } from '@/lib/phoneNormalize';

/** Exibição amigável: +55 (11) 91234-5678 */
export function displayPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 12) return String(raw ?? '');
  const ddd = digits.slice(2, 4);
  const rest = digits.slice(4);
  const mid = rest.length > 8 ? rest.slice(0, 5) : rest.slice(0, 4);
  const end = rest.length > 8 ? rest.slice(5) : rest.slice(4);
  return `+55 (${ddd}) ${mid}-${end}`;
}
