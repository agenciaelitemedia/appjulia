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
import { requireAppIdentity, XJ_GUARD_HEADERS, xjGuardFailed } from "../_shared/x-julia/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": XJ_GUARD_HEADERS,
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

  // Guarda de identidade: função de painel, exige sessão válida do aplicativo.
  const identity = await requireAppIdentity(req);
  if (xjGuardFailed(identity)) return json({ error: identity.error }, identity.status);

  /** Recusa acesso a recursos de outro escritório (admin passa). */
  const sameTenant = (clientId: unknown) =>
    identity.isAdmin || String(clientId ?? "") === identity.clientId;

  try {
    const { action, data } = await req.json();

    // Simulação de conversa: nada é enviado ao lead nem gravado no chat.
    if (action === "simulate") {
      const { data: agent } = await supabase.from("xj_agents").select("*").eq("id", data.agent_id).maybeSingle();
      if (!agent) return json({ error: "agente não encontrado" }, 404);
      if (!sameTenant(agent.client_id)) return json({ error: "agente de outro escritório" }, 403);

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
        clientId: identity.isAdmin && data?.client_id ? String(data.client_id) : identity.clientId,
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
      if (!sameTenant(session.client_id)) return json({ error: "sessão de outro escritório" }, 403);
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

    // Sincronização manual do CRM X-Julia com o quadro "CRM da Julia" no CRM Builder.
    if (action === "crm_sync_builder") {
      const clientId = identity.isAdmin && data?.client_id ? String(data.client_id) : identity.clientId;
      if (!clientId) return json({ error: "escritório não resolvido" }, 400);
      const result = await syncAllDealsToBuilder(supabase, clientId);
      return json({ ok: true, ...result });
    }

    // FinOps: limites de custo/mensagens e consumo do escritório.
    if (action === "usage_get") {
      const clientId = identity.isAdmin && data?.client_id ? String(data.client_id) : identity.clientId;
      if (!clientId) return json({ error: "escritório não resolvido" }, 400);
      const [{ data: limits }, { data: snap }, { data: paused }] = await Promise.all([
        supabase.from("xj_usage_limits").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.rpc("xj_usage_snapshot", { p_client_id: clientId }),
        supabase
          .from("xj_sessions")
          .select("id, contact_name, contact_phone, paused_at, paused_reason")
          .eq("client_id", clientId)
          .not("paused_at", "is", null)
          .order("paused_at", { ascending: false })
          .limit(50),
      ]);
      const snapshot = Array.isArray(snap) ? snap[0] : snap;
      return json({ ok: true, client_id: clientId, limits: limits ?? null, usage: snapshot ?? null, paused_sessions: paused ?? [] });
    }

    if (action === "usage_limits_save") {
      const clientId = identity.isAdmin && data?.client_id ? String(data.client_id) : identity.clientId;
      if (!clientId) return json({ error: "escritório não resolvido" }, 400);
      const row = {
        client_id: clientId,
        daily_cost_usd: Number(data?.daily_cost_usd ?? 5),
        monthly_cost_usd: Number(data?.monthly_cost_usd ?? 100),
        max_msgs_per_hour_per_lead: Number(data?.max_msgs_per_hour_per_lead ?? 30),
        max_msgs_per_hour_per_client: Number(data?.max_msgs_per_hour_per_client ?? 300),
        on_breach: data?.on_breach === "pause" ? "pause" : "notify_only",
        breach_message: String(data?.breach_message ?? "").slice(0, 1000) || undefined,
        is_active: data?.is_active !== false,
      };
      const { data: saved, error } = await supabase
        .from("xj_usage_limits")
        .upsert(row, { onConflict: "client_id" })
        .select("*")
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, limits: saved });
    }

    // Retoma uma sessão pausada pelo disjuntor de custo.
    if (action === "usage_resume_session") {
      const { data: session } = await supabase
        .from("xj_sessions")
        .select("id, client_id")
        .eq("id", String(data?.session_id ?? ""))
        .maybeSingle();
      if (!session) return json({ error: "sessão não encontrada" }, 404);
      if (!sameTenant(session.client_id)) return json({ error: "sessão de outro escritório" }, 403);
      const { error } = await supabase
        .from("xj_sessions")
        .update({ is_active: true, paused_at: null, paused_reason: null })
        .eq("id", session.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: `ação desconhecida: ${action}` }, 400);
  } catch (error) {
    console.error("[x-julia-admin] erro:", error);
    return json({ error: (error as Error).message }, 500);
  }
});