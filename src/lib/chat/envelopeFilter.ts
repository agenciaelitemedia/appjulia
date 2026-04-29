/**
 * Detects "encryption notification" envelope messages that some external
 * WhatsApp automations (e.g. Lopes Bahia) send as standalone messages.
 * The whole message body is the envelope — there is no real content to
 * extract — so we hide it from the conversation view entirely.
 *
 * Examples that match:
 *   "⚠️ *NOTIFICAÇÃO DE CRIPTOGRAFIA* ⚠️\n\n*Lead:* 5511999999999"
 *   "⚠️ NOTIFICAÇÃO DE CRIPTOGRAFIA ⚠️\nLead: +55 11 99999-9999"
 */
const ENVELOPE_RE =
  /^\s*⚠️\s*\*?\s*NOTIFICA[ÇC][ÃA]O\s+DE\s+CRIPTOGRAFIA\s*\*?\s*⚠️\s*\n+\s*\*?\s*Lead:\s*\*?\s*[\d+()\-\s]+\s*$/i;

export function isEncryptionEnvelope(text?: string | null): boolean {
  if (!text || typeof text !== 'string') return false;
  return ENVELOPE_RE.test(text.trim());
}