/**
 * Vínculo de ligações (VoIP / ZAP Call) com o contato do chat.
 *
 * Os provedores gravam o número em formatos diferentes:
 *   - Api4Com / 3C+  : formato nacional "0DDD9XXXXXXXX" (12 díg) ou "DDD9XXXXXXXX" (11 díg)
 *   - Wavoip         : "55DDD9XXXXXXXX" (13) ou "55DDDXXXXXXXX" (12, sem 9º dígito)
 *
 * Para permitir consultar o histórico de qualquer lugar do sistema, sempre
 * gravamos `contact_phone_e164` no formato canônico BR e, quando encontrado,
 * o `contact_id` de `chat_contacts`.
 */

/** Normaliza qualquer formato de telefone recebido de provedores para o canônico BR (55 + DDD + número). */
export function toCallCanonicalBr(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/@.*/, '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  if (d.startsWith('0') && (d.length === 11 || d.length === 12)) return '55' + d.slice(1);
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
}

/** Variantes com/sem o 9º dígito para busca tolerante. */
export function canonicalVariants(canonical: string): string[] {
  const d = (canonical || '').replace(/\D/g, '');
  if (!d) return [];
  const out = new Set<string>([d]);
  if (d.startsWith('55')) {
    const ddd = d.slice(2, 4);
    if (d.length === 13 && d[4] === '9') out.add(`55${ddd}${d.slice(5)}`);
    else if (d.length === 12 && /[6-9]/.test(d[4] ?? '')) out.add(`55${ddd}9${d.slice(4)}`);
  }
  return [...out];
}

/**
 * Escolhe, entre os dois lados da ligação, o número do cliente (ignora ramais curtos).
 */
export function pickCustomerNumber(a: string | null | undefined, b: string | null | undefined): string {
  const da = String(a ?? '').replace(/\D/g, '');
  const db = String(b ?? '').replace(/\D/g, '');
  if (da.length >= 10) return da;
  if (db.length >= 10) return db;
  return '';
}

export interface ContactLink {
  contact_phone_e164: string | null;
  contact_id: string | null;
  conversation_id?: string | null;
}

/**
 * Resolve o vínculo do telefone com o contato de chat do mesmo client_id.
 * Nunca lança: em caso de erro devolve apenas o telefone normalizado.
 */
export async function resolveContactLink(
  admin: any,
  clientId: number | string | null | undefined,
  rawPhone: string | null | undefined,
  opts: { withConversation?: boolean } = {},
): Promise<ContactLink> {
  const canonical = toCallCanonicalBr(rawPhone);
  const result: ContactLink = { contact_phone_e164: canonical || null, contact_id: null };
  if (!canonical || clientId == null) return result;

  try {
    const variants = canonicalVariants(canonical);
    const { data } = await admin
      .from('chat_contacts')
      .select('id')
      .eq('client_id', String(clientId))
      .in('phone', variants)
      .order('updated_at', { ascending: false })
      .limit(1);
    const contactId = data?.[0]?.id ?? null;
    result.contact_id = contactId;

    if (contactId && opts.withConversation) {
      const { data: conv } = await admin
        .from('chat_conversations')
        .select('id')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1);
      result.conversation_id = conv?.[0]?.id ?? null;
    }
  } catch (e) {
    console.error('resolveContactLink failed (non-critical):', (e as Error)?.message ?? e);
  }
  return result;
}

/**
 * Enriquece um registro de `phone_call_logs` (VoIP) com telefone canônico + contact_id.
 * Mutação in-place; nunca lança.
 */
export async function attachCallContactLink(admin: any, entry: any): Promise<void> {
  try {
    const link = await resolveContactLink(
      admin,
      entry?.client_id ?? null,
      pickCustomerNumber(entry?.called, entry?.caller),
    );
    entry.contact_phone_e164 = link.contact_phone_e164;
    if (link.contact_id) entry.contact_id = link.contact_id;
  } catch (e) {
    console.error('attachCallContactLink failed (non-critical):', (e as Error)?.message ?? e);
  }
}
