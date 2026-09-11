/**
 * Controle de acesso ao piloto da LÍDIA.
 *
 * LÍDIA desativada em 2026-09-11 por decisão do usuário. Os arquivos do módulo
 * e a Edge Function `lidia-copilot` foram mantidos para eventual reativação.
 * Basta voltar LIDIA_ENABLED para true.
 */
export const LIDIA_ENABLED = false;

export const LIDIA_PILOT_ALLOWLIST = ['tellmoitas@gmail.com'];

export function isLidiaAllowed(email?: string | null): boolean {
  if (!LIDIA_ENABLED) return false;
  if (!email) return false;
  return LIDIA_PILOT_ALLOWLIST.includes(email.trim().toLowerCase());
}
