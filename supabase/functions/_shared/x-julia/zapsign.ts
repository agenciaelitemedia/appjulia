// ============================================
// X-Julia — integração real com a API do ZapSign (modelos .docx + geração por template)
// ============================================
import type { XJAgent } from "./types.ts";

/** Token padrão citado no wizard — só usado se nada estiver configurado no banco. */
export const ZAPSIGN_DEFAULT_TOKEN = "1c34c87a-37d6-42c3-add9-b3ceaed8eb1d13d47d17-4386-407b-aee9-665af342b622";

const ZAPSIGN_API = "https://api.zapsign.com.br/api/v1";

/** Resolve o token do ZapSign: agente (override) -> escritório -> padrão global -> literal. */
// deno-lint-ignore no-explicit-any
export async function resolveZapsignToken(supabase: any, agent: XJAgent | null, clientId?: string | null): Promise<string> {
  const agentToken = (agent?.contract_api_token ?? "").toString().trim();
  if (agentToken) return agentToken;

  const cid = clientId ?? agent?.client_id ?? null;
  if (cid) {
    const { data } = await supabase
      .from("xj_client_provider_keys")
      .select("api_key")
      .eq("client_id", String(cid))
      .eq("provider", "zapsign")
      .eq("kind", "contract")
      .maybeSingle();
    const k = (data?.api_key ?? "").toString().trim();
    if (k) return k;
  }

  const { data: settings } = await supabase
    .from("xj_provider_settings")
    .select("default_key")
    .eq("provider", "zapsign")
    .eq("kind", "contract")
    .maybeSingle();
  const std = (settings?.default_key ?? "").toString().trim();
  if (std) return std;

  return ZAPSIGN_DEFAULT_TOKEN;
}

/** "402" + "Mario Chat" -> "/402-Mario_Chat/". */
export function slugifyClientFolder(clientId: string, clientName: string): string {
  const slug = (clientName || "escritorio")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "escritorio";
  return `/${clientId}-${slug}/`;
}

export interface ZapsignTemplateVariable {
  variable: string;
  input_type?: string;
  label?: string;
  required?: boolean;
  order?: number;
}

export interface ZapsignCreateTemplateResult {
  template_token: string | null;
  variables: ZapsignTemplateVariable[];
  docx_file_url: string | null;
  raw: unknown;
}

/** Cria o modelo (.docx) no ZapSign — a API já devolve as variáveis {{...}} extraídas do arquivo. */
export async function zapsignCreateTemplate(opts: {
  token: string;
  name: string;
  base64Docx: string;
  folderPath: string;
}): Promise<ZapsignCreateTemplateResult> {
  const res = await fetch(`${ZAPSIGN_API}/templates/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.token}` },
    body: JSON.stringify({
      name: opts.name,
      base64_docx: opts.base64Docx,
      folder_path: opts.folderPath,
    }),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`ZapSign templates/create ${res.status}: ${JSON.stringify(raw).slice(0, 400)}`);
  }
  return {
    template_token: raw?.token ?? null,
    variables: Array.isArray(raw?.inputs) ? raw.inputs : [],
    docx_file_url: raw?.template_file ?? null,
    raw,
  };
}

export interface ZapsignCreateDocResult {
  external_id: string | null;
  sign_url: string | null;
  document_url: string | null;
  raw: unknown;
}

/** Gera o documento real a partir do modelo, com as variáveis já substituídas. */
export async function zapsignCreateDocFromTemplate(opts: {
  token: string;
  templateId: string;
  signerName: string;
  signerPhoneNumber?: string | null;
  signerEmail?: string | null;
  data: Array<{ de: string; para: string }>;
  folderPath: string;
}): Promise<ZapsignCreateDocResult> {
  const res = await fetch(`${ZAPSIGN_API}/models/create-doc/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.token}` },
    body: JSON.stringify({
      template_id: opts.templateId,
      signer_name: opts.signerName,
      signer_phone_country: opts.signerPhoneNumber ? "55" : undefined,
      signer_phone_number: opts.signerPhoneNumber ?? undefined,
      signer_email: opts.signerEmail ?? undefined,
      data: opts.data,
      folder_path: opts.folderPath,
    }),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { external_id: null, sign_url: null, document_url: null, raw: { error: raw, status: res.status } };
  }
  return {
    external_id: raw?.token ?? null,
    sign_url: raw?.signers?.[0]?.sign_url ?? null,
    document_url: raw?.original_file ?? null,
    raw,
  };
}
