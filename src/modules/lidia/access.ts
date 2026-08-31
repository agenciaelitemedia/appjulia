/** Controle de acesso ao piloto da LÍDIA. */
export const LIDIA_PILOT_ALLOWLIST = ['tellmoitas@gmail.com'];

export function isLidiaAllowed(email?: string | null): boolean {
  if (!email) return false;
  return LIDIA_PILOT_ALLOWLIST.includes(email.trim().toLowerCase());
}
