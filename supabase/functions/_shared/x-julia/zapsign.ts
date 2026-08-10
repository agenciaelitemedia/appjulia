// ============================================
// X-Julia — integração real com a API do ZapSign (modelos .docx + geração por template)
// ============================================
import type { XJAgent } from "./types.ts";

/** Token padrão citado no wizard — só usado se nada estiver configurado no banco. */
export const ZAPSIGN_DEFAULT_TOKEN = "b9465cbc-d26f-4d3a-9b0b-77136748386daa08b3ff-1bcf-4cbb-9b42-0f40eb169c02";

const ZAPSIGN_API = "https://api.zapsign.com.br/api/v1";

/**
 * Limite prático do .docx aceito pelo ZapSign. Arquivos pesados (imagens, digitalizações)
 * são aceitos em templates/create, mas a conversão do modelo falha silenciosamente depois:
 * models/create-doc/ responde 200 com o documento vazio (sem token/sign_url).
 */
export const ZAPSIGN_MAX_DOCX_BYTES = 8 * 1024 * 1024;

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
  const approxBytes = Math.floor((opts.base64Docx.length * 3) / 4);
  if (approxBytes > ZAPSIGN_MAX_DOCX_BYTES) {
    throw new Error(
      `O arquivo .docx tem ${(approxBytes / 1024 / 1024).toFixed(1)} MB e o ZapSign não consegue converter modelos tão grandes ` +
        `(limite ~${ZAPSIGN_MAX_DOCX_BYTES / 1024 / 1024} MB). Comprima ou remova as imagens do documento e envie novamente.`,
    );
  }
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
  /** O endpoint de create-doc rejeita folder_path ("Erro inesperado." 400) — a pasta já vem do modelo. */
  folderPath?: string;
}): Promise<ZapsignCreateDocResult> {
  const payload = {
    template_id: opts.templateId,
    signer_name: opts.signerName,
    signer_phone_country: opts.signerPhoneNumber ? "55" : undefined,
    signer_phone_number: opts.signerPhoneNumber ?? undefined,
    signer_email: opts.signerEmail ?? undefined,
    data: opts.data,
  };
  const res = await fetch(`${ZAPSIGN_API}/models/create-doc/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.token}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = { body: text.slice(0, 800) };
  }
  if (!res.ok) {
    console.error("[zapsign] create-doc falhou", res.status, text.slice(0, 800), JSON.stringify(payload).slice(0, 800));
    return {
      external_id: null,
      sign_url: null,
      document_url: null,
      raw: { error: raw, status: res.status, sent: payload },
    };
  }
  // deno-lint-ignore no-explicit-any
  const ok = raw as any;
  // ZapSign às vezes responde 200 com um documento "em branco" (token vazio): significa que
  // a conversão do modelo .docx falhou no lado deles — normalmente arquivo muito pesado.
  if (!ok?.token && !ok?.signers?.[0]?.sign_url) {
    console.error("[zapsign] create-doc retornou documento vazio", text.slice(0, 500));
    return {
      external_id: null,
      sign_url: null,
      document_url: null,
      raw: {
        error:
          "O ZapSign aceitou a requisição mas não gerou o documento (resposta vazia). " +
          "Isso acontece quando o modelo .docx é muito pesado ou não pôde ser convertido: " +
          "reenvie o modelo do caso com um .docx mais leve (até 8 MB, sem imagens grandes).",
        raw,
      },
    };
  }
  return {
    external_id: ok?.token ?? null,
    sign_url: ok?.signers?.[0]?.sign_url ?? null,
    document_url: ok?.original_file ?? null,
    raw,
  };
}
