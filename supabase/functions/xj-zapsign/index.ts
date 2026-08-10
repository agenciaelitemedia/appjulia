// X-Julia — wizard de configuração do ZapSign: confirmar token, subir modelo (.docx),
// mapear variáveis para os campos do caso jurídico.
// GET  ?case_id=...                          -> modelo ativo do caso (ou null)
// POST { action: 'validate_token' | 'upload_template' | 'save_mapping' }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveZapsignToken, slugifyClientFolder, zapsignCreateTemplate, zapsignCreateDocFromTemplate, ZAPSIGN_DEFAULT_TOKEN } from "../_shared/x-julia/zapsign.ts";
import { resolveSystemContractField } from "../_shared/x-julia/datetime.ts";

/** Valores fictícios usados no documento de teste, por campo do catálogo. */
const SAMPLE_VALUES: Record<string, string> = {
  nome_completo: "MARIA DE TESTE DA SILVA",
  seu_cpf: "123.456.789-09",
  sua_identidade: "MG-12.345.678",
  seu_endereco: "Rua de Teste, 100",
  seu_bairro: "Centro",
  sua_cidade: "Uberlândia",
  seu_estado: "MG",
  seu_cep: "38400-000",
  seu_email: "teste@exemplo.com",
  nome_filho: "JOÃO DE TESTE DA SILVA",
  cpf_filho: "987.654.321-00",
  nascimento_filho: "01/01/2015",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const caseId = url.searchParams.get("case_id");
      if (!caseId) return json({ error: "case_id é obrigatório" }, 400);

      const { data, error } = await supabase
        .from("xj_zapsign_templates")
        .select("*")
        .eq("case_id", caseId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ template: data ?? null });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body?.action ?? "");

      if (action === "validate_token") {
        const token = String(body?.token ?? "").trim() || ZAPSIGN_DEFAULT_TOKEN;
        try {
          const res = await fetch("https://api.zapsign.com.br/api/v1/docs/?page_size=1", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.status === 401 || res.status === 403) {
            return json({ ok: false, error: "Token inválido ou sem permissão no ZapSign." });
          }
          return json({ ok: true });
        } catch (err) {
          return json({ ok: false, error: String((err as Error)?.message ?? err) });
        }
      }

      if (action === "upload_template") {
        const clientId = String(body?.client_id ?? "").trim();
        const clientName = String(body?.client_name ?? "").trim();
        const caseId = String(body?.case_id ?? "").trim();
        const agentId = body?.agent_id ? String(body.agent_id) : null;
        const caseName = String(body?.case_name ?? "").trim();
        const base64Docx = String(body?.base64_docx ?? "");
        if (!clientId || !caseId || !caseName || !base64Docx) {
          return json({ error: "client_id, case_id, case_name e base64_docx são obrigatórios" }, 400);
        }

        const { data: agentRow } = agentId
          ? await supabase.from("xj_agents").select("*").eq("id", agentId).maybeSingle()
          : { data: null };

        const token = body?.token ? String(body.token).trim() : await resolveZapsignToken(supabase, agentRow, clientId);
        const folderPath = slugifyClientFolder(clientId, clientName);

        let created;
        try {
          created = await zapsignCreateTemplate({ token, name: caseName, base64Docx, folderPath });
        } catch (err) {
          return json({ error: String((err as Error)?.message ?? err) }, 400);
        }
        if (!created.template_token) {
          return json({ error: "ZapSign não retornou o token do modelo." }, 400);
        }

        const { data: previousActive } = await supabase
          .from("xj_zapsign_templates")
          .select("id")
          .eq("case_id", caseId)
          .eq("is_active", true);

        await supabase
          .from("xj_zapsign_templates")
          .update({ is_active: false })
          .eq("case_id", caseId)
          .eq("is_active", true);

        const { data: row, error } = await supabase
          .from("xj_zapsign_templates")
          .insert({
            client_id: clientId,
            case_id: caseId,
            agent_id: agentId,
            template_token: created.template_token,
            template_name: caseName,
            folder_path: folderPath,
            docx_file_url: created.docx_file_url,
            variables: created.variables,
            field_mapping: {},
            is_active: true,
          })
          .select("*")
          .single();
        if (error) {
          // Rollback: se o insert falhar, o caso não pode ficar sem nenhum modelo ativo.
          if (previousActive?.length) {
            await supabase
              .from("xj_zapsign_templates")
              .update({ is_active: true })
              .in("id", previousActive.map((r: any) => r.id));
          }
          return json({ error: error.message }, 500);
        }

        return json({ ok: true, template: row });
      }

      if (action === "save_mapping") {
        const id = String(body?.id ?? "").trim();
        const fieldMapping = body?.field_mapping;
        if (!id || typeof fieldMapping !== "object" || fieldMapping === null) {
          return json({ error: "id e field_mapping são obrigatórios" }, 400);
        }
        const { data, error } = await supabase
          .from("xj_zapsign_templates")
          .update({ field_mapping: fieldMapping })
          .eq("id", id)
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, template: data });
      }

      if (action === "deactivate_template") {
        // (mantido abaixo)
      }

      if (action === "test_mapping") {
        const id = String(body?.id ?? "").trim();
        const overrideMapping = body?.field_mapping && typeof body.field_mapping === "object"
          ? (body.field_mapping as Record<string, string>)
          : null;
        if (!id) return json({ error: "id é obrigatório" }, 400);

        const { data: templateRow, error: tplError } = await supabase
          .from("xj_zapsign_templates")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (tplError) return json({ error: tplError.message }, 500);
        if (!templateRow?.template_token) return json({ error: "modelo não encontrado" }, 404);

        const mapping = overrideMapping ?? ((templateRow.field_mapping ?? {}) as Record<string, string>);
        const variables = ((templateRow.variables ?? []) as Array<{ variable: string }>).map((v) => v.variable);
        const now = new Date();

        const unmapped: string[] = [];
        const data = variables.map((variable) => {
          const fieldKey = mapping[variable];
          if (!fieldKey) {
            unmapped.push(variable);
            return { de: variable, para: "" };
          }
          const systemValue = resolveSystemContractField(String(fieldKey), now);
          return {
            de: variable,
            para: systemValue ?? SAMPLE_VALUES[String(fieldKey)] ?? `TESTE ${fieldKey}`,
          };
        });

        if (variables.length === 0) {
          return json({ ok: false, unmapped: [], error: "O modelo não tem variáveis {{...}} para testar." });
        }

        const { data: agentRow } = templateRow.agent_id
          ? await supabase.from("xj_agents").select("*").eq("id", templateRow.agent_id).maybeSingle()
          : { data: null };
        const token = body?.token
          ? String(body.token).trim()
          : await resolveZapsignToken(supabase, agentRow, templateRow.client_id);

        const result = await zapsignCreateDocFromTemplate({
          token,
          templateId: templateRow.template_token,
          signerName: "TESTE — não assinar",
          signerEmail: "teste@exemplo.com",
          data,
        });

        if (!result.sign_url) {
          const detail = typeof result.raw === "object" && result.raw !== null
            ? ((result.raw as any).error ?? JSON.stringify(result.raw).slice(0, 400))
            : String(result.raw ?? "sem detalhe");
          return json({ ok: false, unmapped, filled: data, error: String(detail) });
        }

        return json({
          ok: true,
          unmapped,
          filled: data,
          sign_url: result.sign_url,
          document_url: result.document_url,
          external_id: result.external_id,
        });
      }

      if (action === "deactivate_template") {
        const id = String(body?.id ?? "").trim();
        if (!id) return json({ error: "id é obrigatório" }, 400);
        const { data, error } = await supabase
          .from("xj_zapsign_templates")
          .update({ is_active: false })
          .eq("id", id)
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, template: data });
      }

      return json({ error: `ação desconhecida: ${action}` }, 400);
    }

    return json({ error: "método não suportado" }, 405);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
