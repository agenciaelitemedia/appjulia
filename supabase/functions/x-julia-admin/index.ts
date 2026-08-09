// ============================================
// x-julia-admin — operações do painel que exigem servidor
// (teste do agente, geração de contrato manual, prévia de voz)
// ============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { xjComplete } from "../_shared/x-julia/llm.ts";
import { buildXJMessages } from "../_shared/x-julia/prompt.ts";
import { xjGenerateContract } from "../_shared/x-julia/contracts.ts";
import { xjSynthesize } from "../_shared/x-julia/tts.ts";
import { syncAllDealsToBuilder } from "../_shared/x-julia/crm.ts";
import { XJ_TOOLS } from "../_shared/x-julia/skills.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { action, data } = await req.json();

    // Simulação de conversa: nada é enviado ao lead nem gravado no chat.
    if (action === "simulate") {
      const { data: agent } = await supabase.from("xj_agents").select("*").eq("id", data.agent_id).maybeSingle();
      if (!agent) return json({ error: "agente não encontrado" }, 404);

      const legalCase = data.case_id
        ? (await supabase.from("xj_legal_cases").select("*").eq("id", data.case_id).maybeSingle()).data
        : null;

      const [questions, knowledge, catalog] = await Promise.all([
        data.case_id
          ? supabase.from("xj_case_questions").select("position, question, slot_key, is_required")
              .eq("case_id", data.case_id).order("position").then((r: any) => r.data ?? [])
          : Promise.resolve([]),
        data.case_id
          ? supabase.from("xj_case_knowledge").select("title, content").eq("case_id", data.case_id)
              .eq("is_active", true).then((r: any) => r.data ?? [])
          : Promise.resolve([]),
        supabase.from("xj_legal_cases").select("id, name, category, summary")
          .eq("client_id", String(agent.client_id)).eq("is_active", true).order("position")
          .then((r: any) => r.data ?? []),
      ]);

      const session = {
        ...(data.session ?? {}),
        client_id: String(agent.client_id),
        stage: data.stage ?? "recepcao",
        slots: data.slots ?? {},
        contact_name: data.contact_name ?? null,
        channel: "simulacao",
        origin: "simulacao",
      };

      const messages = buildXJMessages({
        agent: { ...agent, stage_prompts: agent.stage_prompts ?? {} } as any,
        session: session as any,
        legalCase: legalCase as any,
        questions,
        knowledge,
        caseCatalog: catalog,
        history: (data.history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
        currentInput: String(data.message ?? ""),
      });

      const completion = await xjComplete({
        supabase,
        provider: agent.llm_provider,
        model: agent.llm_model,
        fallbackEnabled: agent.llm_fallback_enabled,
        clientId: agent.client_id,
        keyMode: (agent as any).llm_key_mode ?? "default",
        messages,
        tools: XJ_TOOLS,
        temperature: 0.5,
      });

      return json({
        ok: true,
        text: completion.text,
        skills: completion.toolCalls.map((t) => ({ name: t.name, args: t.args })),
        provider: completion.provider,
        model: completion.model,
        duration_ms: completion.durationMs,
      });
    }

    if (action === "voice_preview") {
      const result = await xjSynthesize(supabase, {
        clientId: String(data.client_id ?? "0"),
        text: String(data.text ?? "Olá! Sou a assistente do escritório."),
        provider: String(data.provider ?? "elevenlabs"),
        voiceId: data.voice_id ?? null,
        settings: data.settings ?? {},
        keyMode: String(data.key_mode ?? "default"),
      });
      return "url" in result ? json({ ok: true, url: result.url }) : json({ error: result.error }, 400);
    }

    if (action === "generate_contract") {
      const { data: session } = await supabase
        .from("xj_sessions")
        .select("*")
        .eq("id", data.session_id)
        .maybeSingle();
      if (!session) return json({ error: "sessão não encontrada" }, 404);
      const { data: agent } = await supabase.from("xj_agents").select("*").eq("id", session.agent_id).maybeSingle();
      const legalCase = session.case_id
        ? (await supabase.from("xj_legal_cases").select("*").eq("id", session.case_id).maybeSingle()).data
        : null;

      const contract = await xjGenerateContract(supabase, agent as any, session as any, legalCase as any, {
        signer_name: String(data.signer_name ?? session.contact_name ?? ""),
        signer_document: data.signer_document ?? null,
        value: typeof data.value === "number" ? data.value : null,
        provider: data.provider ?? null,
      });
      return json({ ok: true, ...contract });
    }

    return json({ error: `ação desconhecida: ${action}` }, 400);
  } catch (error) {
    console.error("[x-julia-admin] erro:", error);
    return json({ error: (error as Error).message }, 500);
  }
});