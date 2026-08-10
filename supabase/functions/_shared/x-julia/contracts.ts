// ============================================
// X-Julia — contratos com provider plugável (internal | zapsign)
// ============================================
import type { XJAgent, XJLegalCase, XJSession } from "./types.ts";
import { resolveZapsignToken, zapsignCreateDocFromTemplate } from "./zapsign.ts";
import { resolveSystemContractField } from "./datetime.ts";

function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const value = String(key).split(".").reduce<any>((acc, part) => (acc == null ? acc : acc[part]), vars);
    return value == null ? "" : String(value);
  });
}

const FALLBACK_TEMPLATE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS

CONTRATANTE: {{signer_name}}, CPF {{signer_document}}, telefone {{signer_phone}}.
OBJETO: atuação jurídica referente a {{case_name}}.
HONORÁRIOS: {{fee_description}}
VALOR: R$ {{value}}

Data: {{date}}`;

// deno-lint-ignore no-explicit-any
export async function xjGenerateContract(
  supabase: any,
  agent: XJAgent,
  session: XJSession,
  legalCase: XJLegalCase | null,
  input: { signer_name: string; signer_document?: string | null; value?: number | null; provider?: string | null },
): Promise<{ id: string; sign_url: string | null; status: string; provider: string; via_template?: boolean }> {
  let provider = (input.provider || legalCase?.contract_provider || agent.contract_provider || "internal").toLowerCase();

  // O contrato pode ser gerado com o agente de recepção em mãos (handoff), cujo provider é
  // "internal". Se o caso já tem um modelo ativo no ZapSign, ele manda no provider.
  const providerCaseId = legalCase?.id ?? session.case_id;
  if (provider !== "zapsign" && providerCaseId) {
    const { data: activeTemplate } = await supabase
      .from("xj_zapsign_templates")
      .select("id")
      .eq("case_id", providerCaseId)
      .eq("is_active", true)
      .maybeSingle();
    if (activeTemplate?.id) provider = "zapsign";
  }
  const template = legalCase?.contract_template || agent.contract_template || FALLBACK_TEMPLATE;

  const rendered = renderTemplate(template, {
    signer_name: input.signer_name,
    signer_document: input.signer_document ?? "",
    signer_phone: session.phone ?? "",
    case_name: legalCase?.name ?? session.case_type ?? "caso jurídico",
    fee_description: legalCase?.fee_description ?? "conforme combinado no atendimento",
    value: input.value ?? legalCase?.min_ticket ?? "",
    date: new Date().toLocaleDateString("pt-BR"),
    slots: session.slots,
  });

  const { data: deal } = await supabase
    .from("xj_deals")
    .select("id")
    .eq("session_id", session.id)
    .maybeSingle();

  const { data: contract, error } = await supabase
    .from("xj_contracts")
    .insert({
      client_id: session.client_id,
      session_id: session.id,
      deal_id: deal?.id ?? null,
      case_id: session.case_id,
      provider,
      template,
      rendered_content: rendered,
      signer_name: input.signer_name,
      signer_document: input.signer_document ?? null,
      signer_phone: session.phone,
      value: input.value ?? null,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw error;

  if (provider === "zapsign") {
    const viaTemplate = await sendViaZapSignTemplate(supabase, agent, legalCase, session, input);
    const result = viaTemplate ?? await sendViaZapSign(supabase, agent, contract, rendered, session);
    await supabase
      .from("xj_contracts")
      .update({
        external_id: result.external_id,
        sign_url: result.sign_url,
        document_url: result.document_url,
        status: result.sign_url ? "sent" : "error",
        sent_at: new Date().toISOString(),
        metadata: result.raw ?? {},
        template_id: viaTemplate?.templateRowId ?? null,
      })
      .eq("id", contract.id);
    if (!result.sign_url) {
      const detail = typeof result.raw === "object" && result.raw !== null
        ? JSON.stringify(result.raw).slice(0, 300)
        : String(result.raw ?? "sem detalhe");
      throw new Error(
        `ZapSign não devolveu link de assinatura${viaTemplate ? "" : " (modelo .docx do caso não configurado — use o assistente ZapSign na aba Contrato do agente)"}: ${detail}`,
      );
    }
    return { id: contract.id, sign_url: result.sign_url, status: "sent", provider, via_template: !!viaTemplate };
  }

  // Provider interno: link de assinatura hospedado pelo próprio módulo.
  const signUrl = `${Deno.env.get("XJ_PUBLIC_APP_URL") ?? "https://acesso.atendejulia.com.br"}/x-julia/contrato/${contract.id}`;
  await supabase
    .from("xj_contracts")
    .update({ sign_url: signUrl, status: "sent", sent_at: new Date().toISOString() })
    .eq("id", contract.id);
  return { id: contract.id, sign_url: signUrl, status: "sent", provider };
}

/**
 * Usa o modelo (.docx) real configurado no ZapSign para o caso, com as variáveis
 * já mapeadas para os campos coletados na sessão. Retorna null quando o caso ainda
 * não passou pelo wizard — nesse caso o chamador cai no fallback (sendViaZapSign).
 */
// deno-lint-ignore no-explicit-any
async function sendViaZapSignTemplate(
  supabase: any,
  agent: XJAgent,
  legalCase: XJLegalCase | null,
  session: XJSession,
  input: { signer_name: string; signer_document?: string | null; value?: number | null },
): Promise<{ external_id: string | null; sign_url: string | null; document_url: string | null; raw: unknown; templateRowId: string } | null> {
  const caseId = legalCase?.id ?? session.case_id;
  if (!caseId) return null;

  const { data: templateRow } = await supabase
    .from("xj_zapsign_templates")
    .select("*")
    .eq("case_id", caseId)
    .eq("is_active", true)
    .maybeSingle();
  if (!templateRow?.template_token) return null;

  const mapping = (templateRow.field_mapping ?? {}) as Record<string, string>;
  const now = new Date();
  const data = Object.entries(mapping)
    .filter(([, fieldKey]) => !!fieldKey)
    .map(([zapsignVar, fieldKey]) => {
      const systemValue = resolveSystemContractField(String(fieldKey), now);
      return {
        de: zapsignVar,
        para: systemValue ?? String(session.slots?.[fieldKey] ?? ""),
      };
    });
  // Wizard ainda não concluiu o mapeamento: usa o fallback (conteúdo renderizado) em vez de
  // gerar o documento com as variáveis do modelo todas vazias.
  if (data.length === 0) return null;

  const token = await resolveZapsignToken(supabase, agent, session.client_id);

  const result = await zapsignCreateDocFromTemplate({
    token,
    templateId: templateRow.template_token,
    signerName: input.signer_name,
    signerPhoneNumber: (session.phone ?? "").replace(/^55/, "") || null,
    data,
  });

  return { ...result, templateRowId: templateRow.id };
}

// deno-lint-ignore no-explicit-any
async function sendViaZapSign(supabase: any, agent: XJAgent | null, contract: any, rendered: string, session: XJSession) {
  // Mesma cadeia de resolução do caminho por modelo: agente -> escritório -> padrão global.
  const token = (await resolveZapsignToken(supabase, agent, session.client_id)).trim();
  if (!token) return { external_id: null, sign_url: null, document_url: null, raw: { error: "token zapsign ausente" } };

  try {
    const res = await fetch("https://api.zapsign.com.br/api/v1/docs/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: `Contrato — ${contract.signer_name ?? session.phone}`,
        content: rendered,
        lang: "pt-br",
        signers: [
          {
            name: contract.signer_name ?? "Contratante",
            phone_country: "55",
            phone_number: (session.phone ?? "").replace(/^55/, ""),
          },
        ],
      }),
    });
    const json = await res.json();
    return {
      external_id: json?.token ?? null,
      sign_url: json?.signers?.[0]?.sign_url ?? null,
      document_url: json?.original_file ?? null,
      raw: json,
    };
  } catch (err) {
    return { external_id: null, sign_url: null, document_url: null, raw: { error: String(err) } };
  }
}