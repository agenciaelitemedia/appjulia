/**
 * Resolução de cards do CRM Builder por telefone (BR, com e sem o 9).
 *
 * Usado tanto pela listagem (`julia_builder_listar_negocios`) quanto pela
 * movimentação (`julia_card_mover_por_telefone`), para que a busca por telefone
 * devolva sempre o mesmo conjunto que aparece na tela do CRM.
 *
 * Regra de visibilidade: cards com `status = 'archived'` NÃO aparecem no CRM,
 * portanto entram só em `historico`.
 */

export const DEAL_LOOKUP_COLS =
  "id, title, status, pipeline_id, board_id, contact_name, contact_phone, custom_fields, stage_entered_at, updated_at";

/** Gera as variantes brasileiras (12 e 13 dígitos) de um telefone. */
export function brPhoneVariants(raw: string): string[] {
  let d = String(raw ?? "").replace(/@.*/, "").replace(/\D/g, "");
  if (!d) return [];
  if (d.startsWith("055")) d = d.slice(1);
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = `55${d}`;
  const out = new Set<string>([d]);
  if (d.startsWith("55")) {
    const ddd = d.slice(2, 4);
    if (d.length === 13 && d[4] === "9") out.add(`55${ddd}${d.slice(5)}`);
    else if (d.length === 12 && /[6-9]/.test(d[4] ?? "")) out.add(`55${ddd}9${d.slice(4)}`);
  }
  return [...out];
}

export interface PhoneContact {
  id: string;
  name: string | null;
  phone: string | null;
}

export interface PhoneLookupResult {
  variants: string[];
  /** Todos os contatos do tenant com qualquer variante do telefone (duplicados incluídos). */
  contacts: PhoneContact[];
  /** Contato preferido: o que tem nome real, senão o mais recente. */
  contact: PhoneContact | null;
  /** Cards que realmente aparecem no CRM (status != archived). */
  // deno-lint-ignore no-explicit-any
  visiveis: any[];
  /** Cards arquivados (não aparecem no CRM). */
  // deno-lint-ignore no-explicit-any
  historico: any[];
}

function looksLikeRealName(name: string | null | undefined, variants: string[]): boolean {
  const n = String(name ?? "").trim();
  if (!n) return false;
  const digits = n.replace(/\D/g, "");
  if (digits && variants.includes(digits)) return false;
  return /[A-Za-zÀ-ÿ]/.test(n);
}

/**
 * Busca cards por telefone em um painel, restrito ao escritório.
 * Combina: telefone do card, contato do chat e vínculos gravados em custom_fields.
 */
export async function resolveDealsByPhone(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  clientId: string | number,
  boardId: string,
  phoneRaw: string,
): Promise<PhoneLookupResult> {
  const variants = brPhoneVariants(phoneRaw);
  if (!variants.length) return { variants, contacts: [], contact: null, visiveis: [], historico: [] };

  // Contatos do chat (podem existir duplicados com/sem o 9).
  const { data: contactRows, error: contactErr } = await supabase
    .from("chat_contacts")
    .select("id, name, phone, updated_at")
    .eq("client_id", clientId)
    .in("phone", variants)
    .order("updated_at", { ascending: false });
  if (contactErr) throw new Error(contactErr.message);

  const contacts: PhoneContact[] = (contactRows || []).map(
    // deno-lint-ignore no-explicit-any
    (c: any) => ({ id: String(c.id), name: c.name ?? null, phone: c.phone ?? null }),
  );
  const contact = contacts.find((c) => looksLikeRealName(c.name, variants)) ?? contacts[0] ?? null;
  const contactIds = new Set(contacts.map((c) => c.id));

  // Cards do painel: busca única, filtragem local por telefone/contato vinculado.
  const { data: dealRows, error: dealErr } = await supabase
    .from("crm_deals")
    .select(DEAL_LOOKUP_COLS)
    .eq("client_id", clientId)
    .eq("board_id", boardId)
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (dealErr) throw new Error(dealErr.message);

  // deno-lint-ignore no-explicit-any
  const matched = (dealRows || []).filter((d: any) => {
    const p = String(d.contact_phone ?? "").replace(/\D/g, "");
    if (p && variants.includes(p)) return true;
    const cf = (d.custom_fields ?? {}) as Record<string, unknown>;
    // deno-lint-ignore no-explicit-any
    const linked = (cf as any)?.links?.chat?.contact_id ?? (cf as any)?.dsp_contact_id ?? null;
    return linked ? contactIds.has(String(linked)) : false;
  });

  // deno-lint-ignore no-explicit-any
  const visiveis = matched.filter((d: any) => String(d.status ?? "") !== "archived");
  // deno-lint-ignore no-explicit-any
  const historico = matched.filter((d: any) => String(d.status ?? "") === "archived");

  // Prioriza cards abertos ao mover.
  // deno-lint-ignore no-explicit-any
  visiveis.sort((a: any, b: any) => {
    const rank = (s: string) => (s === "open" ? 0 : 1);
    const r = rank(String(a.status ?? "")) - rank(String(b.status ?? ""));
    if (r !== 0) return r;
    return String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
  });

  return { variants, contacts, contact, visiveis, historico };
}
