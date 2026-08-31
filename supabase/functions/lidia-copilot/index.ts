// LÍDIA — copiloto de vendas para atendentes sem conhecimento jurídico/técnico.
// Conduz o atendente passo a passo no chat, baseado no agente da fila, no histórico
// da conversa, nos resumos e no card do CRM.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { resolveAI, providerHeaders } from "../_shared/aiGateway.ts";
import { logAIUsage } from "../_shared/aiUsageLogger.ts";

const PILOT_ALLOWLIST = ["tellmoitas@gmail.com"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeCaCert(input: string): string[] {
  let text = input.trim().replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  if (!text.includes("BEGIN CERTIFICATE")) {
    try {
      const decoded = atob(text);
      if (decoded.includes("BEGIN CERTIFICATE")) text = decoded;
    } catch { /* ignore */ }
  }
  const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!blocks) return [];
  const wrap64 = (s: string) => s.match(/.{1,64}/g)?.join("\n") ?? s;
  return blocks.map((block) => {
    const b64 = block
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s+/g, "");
    return `-----BEGIN CERTIFICATE-----\n${wrap64(b64)}\n-----END CERTIFICATE-----\n`;
  });
}

const rawCa = Deno.env.get("EXTERNAL_DB_CA_CERT") ?? "";
const caCerts = rawCa ? normalizeCaCert(rawCa) : [];
let extPool: ReturnType<typeof postgres> | null = null;

function getExtPool() {
  if (extPool) return extPool;
  const url = (Deno.env.get("EXTERNAL_DB_URL") ?? "").trim();
  const isUnixSocket = url.includes("/.s.PGSQL.") || url.startsWith("socket:")
    || (Deno.env.get("EXTERNAL_DB_HOST") ?? "").includes("/.s.PGSQL.");
  const ssl = isUnixSocket ? false : caCerts.length > 0 ? { caCerts, rejectUnauthorized: true } : "require" as const;
  const opts = {
    ssl,
    connect_timeout: 15,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    max: 3,
    prepare: false,
    onconnect: async (conn: any) => {
      try {
        await conn.unsafe("SET statement_timeout = 20000");
        await conn.unsafe("SET timezone = 'America/Sao_Paulo'");
      } catch { /* ignore */ }
    },
  };
  extPool = url
    ? postgres(url, opts as any)
    : postgres({
      host: Deno.env.get("EXTERNAL_DB_HOST"),
      port: parseInt(Deno.env.get("EXTERNAL_DB_PORT") || "25061"),
      database: Deno.env.get("EXTERNAL_DB_DATABASE"),
      username: Deno.env.get("EXTERNAL_DB_USERNAME"),
      password: Deno.env.get("EXTERNAL_DB_PASSWORD"),
      ...opts,
    } as any);
  return extPool;
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function digits(v: unknown): string {
  return String(v ?? "").replace(/@.*/, "").replace(/\D/g, "");
}

function phoneKey(phone: unknown): string {
  const d = digits(phone);
  if (!d) return "";
  const withCc = d.startsWith("55") ? d : `55${d}`;
  const body = withCc.slice(2);
  const ddd = body.slice(0, 2);
  let rest = body.slice(2);
  if (rest.length === 9 && rest.startsWith("9")) rest = rest.slice(1);
  return `${ddd}${rest}`;
}

function renderMessageForTranscript(m: {
  text?: string | null;
  from_me?: boolean | null;
  sender_name?: string | null;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
}): string | null {
  const who = m.from_me ? "ATENDENTE" : "CLIENTE";
  const sender = m.sender_name ? ` (${m.sender_name})` : "";
  const t = (m.type ?? "text").toLowerCase();
  if (t === "audio" || t === "ptt") {
    const meta = m.metadata as Record<string, unknown> | null | undefined;
    const tr = meta && typeof meta === "object" ? (meta as { transcription?: { text?: string } }).transcription : undefined;
    const transcriptText = tr?.text?.trim();
    if (transcriptText) {
      return `[${who}${sender}] (áudio transcrito): ${transcriptText}`;
    }
    return `[${who}${sender}] (áudio sem transcrição)`;
  }
  if (t === "image") {
    const caption = m.text?.trim();
    return caption ? `[${who}${sender}] (imagem): ${caption}` : `[${who}${sender}] (imagem)`;
  }
  if (t === "video") {
    const caption = m.text?.trim();
    return caption ? `[${who}${sender}] (vídeo): ${caption}` : `[${who}${sender}] (vídeo)`;
  }
  if (t === "sticker") return `[${who}${sender}] (sticker)`;
  if (!m.text) return null;
  return `[${who}${sender}]: ${m.text}`;
}

const SYSTEM_PROMPT = `Você é a LÍDIA, uma especialista em vendas jurídicas que conduz atendentes de escritórios de advocacia. O atendente NÃO tem conhecimento jurídico e NÃO tem conhecimento técnico de vendas. Ele depende 100% de você.

Sua missão: pensar o caso junto com o atendente e dizer EXATAMENTE o que ele deve fazer, perguntar ou responder a cada momento, até o fechamento do contrato.

REGRAS DE COMUNICAÇÃO:
- Use linguagem simples, de pessoa. Nada de jargão jurídico sem explicação.
- Cada instrução deve começar com um verbo claro: "Pergunte...", "Explique...", "Sugira...", "Ligue...".
- Explique o PORQUÊ de cada pergunta em uma frase curta, para o atendente entender o que fazer com a resposta.
- Termos como prescrição, decadência, honorários de êxito, procuração, contrato de honorários etc. devem vir acompanhados de uma explicação rápida.
- Seja calorosa, como uma colega experiente ao lado do atendente. Não seja robótica.

REGRAS DE ANÁLISE:
- Leve o atendente pelas fases: Abertura → Diagnóstico do caso → Análise jurídica → Proposta/Valor → Objeções → Fechamento/Contrato → Pós-assinatura.
- NUNCA invente fatos. Só use informações que aparecem na conversa, resumos ou card do CRM.
- Quando faltar informação, diga explicitamente "Preciso que o cliente confirme isso".
- Avalie a força do caso como: forte / médio / fraco / inconclusivo (quando faltam dados).
- Identifique objeções comuns: preço, desconfiança, "vou pensar", "vou consultar", silêncio.
- Se a objeção for forte ou o cliente parar de responder, sugira uma ligação e monte um roteiro passo a passo.

FORMATO OBRIGATÓRIO DA RESPOSTA (JSON):
{
  "phase": "abertura|diagnostico|analise_juridica|proposta|objecoes|fechamento|pos_assinatura",
  "next_step": "uma única ação clara para o atendente executar agora",
  "confidence": 0.0 a 1.0,
  "incomplete_info": ["lista de informações que ainda faltam para decidir"],
  "questions": [
    {"text": "pergunta pronta para enviar", "why": "por que perguntar isso"}
  ],
  "suggested_reply": {"when_to_use": "contexto", "text": "texto pronto para enviar"},
  "legal_analysis": {
    "summary": "explicação simples do caso jurídico",
    "strength": "forte|medio|fraco|inconclusivo",
    "evidence_needed": ["provas/documentos a solicitar"],
    "risks": ["riscos em linguagem simples"]
  },
  "objection": {
    "detected": false,
    "type": "preco|desconfianca|vou_pensar|silencio|outra",
    "technique": "técnica de contorno simples",
    "reply": "fala sugerida"
  },
  "call": {
    "recommended": false,
    "reason": "por que ligar",
    "script": [
      {"step": "abertura", "text": "fala"},
      {"step": "pontos_chave", "text": "fala"},
      {"step": "contorno", "text": "fala"},
      {"step": "fechamento", "text": "fala"}
    ]
  },
  "understanding_check": "pergunta curta para confirmar que o atendente entendeu o próximo passo"
}`;

interface AgentRow {
  cod_agent: string | number;
  prompt: string | null;
  settings: Record<string, unknown> | null;
}

async function getAgentForConversation(
  ext: ReturnType<typeof postgres>,
  clientId: string,
  queueId: string | null,
  codAgent?: string | number | null,
): Promise<AgentRow | null> {
  try {
    if (queueId) {
      const links = await ext`
        SELECT cod_agent FROM queue_agent_links
        WHERE queue_id = ${queueId} AND is_primary = true
        LIMIT 1
      `;
      if (links.length && links[0].cod_agent) {
        const agent = await ext`
          SELECT cod_agent, prompt, settings FROM agents
          WHERE client_id = ${clientId} AND cod_agent = ${links[0].cod_agent}
          LIMIT 1
        `;
        if (agent.length) return agent[0] as AgentRow;
      }
    }
    if (codAgent) {
      const agent = await ext`
        SELECT cod_agent, prompt, settings FROM agents
        WHERE client_id = ${clientId} AND cod_agent = ${codAgent}
        LIMIT 1
      `;
      if (agent.length) return agent[0] as AgentRow;
    }
    return null;
  } catch (e) {
    console.warn("[lidia-copilot] agent lookup failed:", e);
    return null;
  }
}

async function loadContext(
  supabase: ReturnType<typeof getSupabase>,
  ext: ReturnType<typeof postgres>,
  conversationId: string,
  clientId: string,
) {
  const { data: conv, error: convError } = await supabase
    .from("chat_conversations")
    .select("id, contact_id, client_id, queue_id, assigned_user_id, status, channel")
    .eq("id", conversationId)
    .maybeSingle();

  if (convError) {
    console.warn("[lidia-copilot] conversation lookup error:", convError);
  }

  if (!conv) throw new Error("Conversa não encontrada");
  if (String(conv.client_id) !== String(clientId)) throw new Error("Escopo inválido");

  const { data: contact } = await supabase
    .from("chat_contacts")
    .select("id, name, phone, email, cpf_cnpj, tags")
    .eq("id", conv.contact_id)
    .maybeSingle();

  const { data: queue } = conv.queue_id
    ? await supabase.from("queues").select("id, name, channel_type").eq("id", conv.queue_id).maybeSingle()
    : { data: null };

  const agent = await getAgentForConversation(ext, clientId, conv.queue_id ?? null, null);

  // CRM Builder card (chat_crm_links)
  const { data: crmLink } = await supabase
    .from("chat_crm_links")
    .select("deal_id, crm_deals(id, title, value, stage_id, crm_pipeline_stages(name, color))")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .maybeSingle();

  // CRM Julia card (legacy) via phone key
  const phone = contact?.phone ?? null;
  const key = phone ? phoneKey(phone) : "";
  let crmJulia: any = null;
  if (key && agent) {
    try {
      const rows = await ext`
        SELECT c.id, c.nome, c.telefone, c.fase, c.valor, c.status, c.cod_agent, s.nome AS stage_name
        FROM crm_atendimento_cards c
        LEFT JOIN crm_atendimento_stages s ON s.id = c.fase
        WHERE c.client_id = ${clientId}
          AND c.cod_agent = ${agent.cod_agent}
          AND regexp_replace(c.telefone, '[^0-9]', '', 'g') LIKE ${"%" + key}
        ORDER BY c.id DESC
        LIMIT 1
      `;
      if (rows.length) crmJulia = rows[0];
    } catch (e) {
      console.warn("[lidia-copilot] crm legacy lookup failed:", e);
    }
  }

  // Resumos
  const { data: summaries } = await supabase
    .from("chat_conversation_summaries")
    .select("summary, first_message_ts, last_message_ts, created_at")
    .eq("contact_id", conv.contact_id)
    .order("last_message_ts", { ascending: false, nullsFirst: false })
    .limit(5);

  // Últimas mensagens
  const msgs: any[] = [];
  const PAGE = 200;
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await supabase
      .from("chat_messages")
      .select("id, text, from_me, sender_name, timestamp, type, metadata")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !page || page.length === 0) break;
    msgs.push(...page);
    if (page.length < PAGE) break;
  }
  const transcript = msgs.map(renderMessageForTranscript).filter((x): x is string => !!x).join("\n");

  // Última análise LÍDIA
  const { data: session } = await supabase
    .from("lidia_sessions")
    .select("phase, last_analysis, confidence")
    .eq("client_id", clientId)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  // Config LÍDIA
  const { data: config } = await supabase
    .from("lidia_client_config")
    .select("enabled, sales_profile, silence_minutes")
    .eq("client_id", clientId)
    .maybeSingle();

  return {
    conv,
    contact,
    queue,
    agent,
    crmBuilder: crmLink?.crm_deals ?? null,
    crmJulia,
    summaries: summaries ?? [],
    transcript,
    session,
    config,
  };
}

function buildPrompt(ctx: Awaited<ReturnType<typeof loadContext>>, question?: string | null) {
  const parts: string[] = [];
  parts.push("# AGENTE DA FILA");
  if (ctx.agent) {
    parts.push(`cod_agent: ${ctx.agent.cod_agent}`);
    if (ctx.agent.prompt) parts.push(`Prompt do agente:\n${ctx.agent.prompt}`);
    if (ctx.agent.settings) parts.push(`Configurações: ${JSON.stringify(ctx.agent.settings, null, 2)}`);
  } else {
    parts.push("Nenhum agente vinculado à fila. Use o perfil de vendas do escritório (se houver) ou um discurso jurídico genérico e amigável.");
  }

  parts.push("\n# PERFIL DE VENDAS DO ESCRITÓRIO");
  if (ctx.config?.sales_profile) {
    parts.push(JSON.stringify(ctx.config.sales_profile, null, 2));
  } else {
    parts.push("Não configurado.");
  }

  parts.push("\n# CONTATO");
  if (ctx.contact) {
    parts.push(`Nome: ${ctx.contact.name || "(não informado)"}`);
    parts.push(`Telefone: ${ctx.contact.phone || "(não informado)"}`);
    parts.push(`Email: ${ctx.contact.email || "(não informado)"}`);
    parts.push(`CPF/CNPJ: ${ctx.contact.cpf_cnpj || "(não informado)"}`);
  }

  parts.push("\n# CONVERSA");
  parts.push(`Fila: ${ctx.queue?.name || "(não informada)"}`);
  parts.push(`Canal: ${ctx.conv.channel || "(não informado)"}`);
  parts.push(`Status: ${ctx.conv.status || "(não informado)"}`);

  parts.push("\n# RESUMOS ANTERIORES");
  if (ctx.summaries.length) {
    ctx.summaries.forEach((s, i) => {
      parts.push(`Resumo ${i + 1} (${s.first_message_ts ?? "?"} → ${s.last_message_ts ?? "?"}):\n${s.summary}`);
    });
  } else {
    parts.push("Nenhum resumo anterior.");
  }

  parts.push("\n# ÚLTIMAS MENSAGENS");
  if (ctx.transcript) parts.push(ctx.transcript);
  else parts.push("Nenhuma mensagem disponível.");

  parts.push("\n# CARD DO CRM BUILDER");
  if (ctx.crmBuilder) {
    parts.push(JSON.stringify(ctx.crmBuilder, null, 2));
  } else {
    parts.push("Nenhum card vinculado no CRM Builder.");
  }

  parts.push("\n# CARD DO CRM JULIA");
  if (ctx.crmJulia) {
    parts.push(JSON.stringify(ctx.crmJulia, null, 2));
  } else {
    parts.push("Nenhum card vinculado no CRM Julia.");
  }

  parts.push("\n# ANÁLISE ANTERIOR DA LÍDIA");
  if (ctx.session?.last_analysis) {
    parts.push(`Fase anterior: ${ctx.session.phase}`);
    parts.push(JSON.stringify(ctx.session.last_analysis, null, 2));
  } else {
    parts.push("Primeira análise.");
  }

  if (question) {
    parts.push(`\n# PERGUNTA DO ATENDENTE\n${question}`);
  }

  parts.push("\n# INSTRUÇÃO FINAL\nResponda no JSON estruturado definido no system prompt.");
  return parts.join("\n");
}

async function callAI(
  supabase: ReturnType<typeof getSupabase>,
  prompt: string,
  feature: string,
) {
  const ai = await resolveAI(supabase, feature);
  if (!ai.apiKey) throw new Error("IA não configurada (sem chave).");

  const started = Date.now();
  const resp = await fetch(ai.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ai.apiKey}`,
      "Content-Type": "application/json",
      ...providerHeaders(ai.provider),
    },
    body: JSON.stringify({
      model: ai.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const duration = Date.now() - started;

  if (resp.status === 429) return { status: 429, error: "Limite de uso da IA atingido." };
  if (resp.status === 402) return { status: 402, error: "Créditos da IA esgotados." };
  if (!resp.ok) {
    const text = await resp.text();
  await logAIUsage(supabase, {
    client_id: clientId,
    feature,
    provider: ai.provider,
      endpoint: ai.endpoint,
      model: ai.model,
      status: "failed",
      duration_ms: duration,
      error_reason: `ai_${resp.status}`,
    });
    return { status: 500, error: "Erro na IA", detail: text };
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content ?? "";
  await logAIUsage(supabase, {
    feature,
    provider: ai.provider,
    endpoint: ai.endpoint,
    model: ai.model,
    status: "ok",
    duration_ms: duration,
    usage: data?.usage ?? {},
  });
  return { status: 200, raw };
}

function parseAIOutput(raw: string): any {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/m, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("[lidia-copilot] parse failed:", e, raw.slice(0, 500));
    return null;
  }
}

function emptyOutput(reason: string): any {
  return {
    phase: "abertura",
    next_step: "Aguarde enquanto revisamos as informações.",
    confidence: 0,
    incomplete_info: [reason],
    questions: [],
    suggested_reply: { when_to_use: "", text: "" },
    legal_analysis: { summary: "", strength: "inconclusivo", evidence_needed: [], risks: [] },
    objection: { detected: false, type: "", technique: "", reply: "" },
    call: { recommended: false, reason: "", script: [] },
    understanding_check: "Entendeu qual é o próximo passo?",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, conversation_id, client_id, user_email, question } = body;

    if (!conversation_id || !client_id || !user_email) {
      return json({ error: "conversation_id, client_id e user_email são obrigatórios" }, 400);
    }

    if (!PILOT_ALLOWLIST.includes(user_email)) {
      return json({ error: "LÍDIA ainda não está liberada para este usuário." }, 403);
    }

    const supabase = getSupabase();
    const ext = getExtPool();

    if (action === "chat" && question) {
      // Armazena pergunta do atendente
      await supabase.from("lidia_messages").insert({
        client_id,
        conversation_id,
        role: "user",
        content: question,
      });
    }

    const ctx = await loadContext(supabase, ext, conversation_id, client_id);
    const prompt = buildPrompt(ctx, question ?? null);
    const aiResult = await callAI(supabase, prompt, "lidia_copilot");

    if (aiResult.status !== 200) {
      return json({ error: aiResult.error, detail: (aiResult as any).detail }, aiResult.status);
    }

    let output = parseAIOutput(aiResult.raw);
    if (!output) output = emptyOutput("Não foi possível interpretar a resposta da IA.");

    // Persiste sessão
    await supabase.from("lidia_sessions").upsert({
      client_id,
      conversation_id,
      phase: output.phase || "abertura",
      last_analysis: output,
      confidence: typeof output.confidence === "number" ? output.confidence : null,
    }, { onConflict: "client_id,conversation_id" });

    // Persiste resposta da LÍDIA
    await supabase.from("lidia_messages").insert({
      client_id,
      conversation_id,
      role: "assistant",
      content: output.next_step || "Análise concluída.",
    });

    return json({ output, agent: ctx.agent ? { cod_agent: ctx.agent.cod_agent } : null });
  } catch (e) {
    console.error("[lidia-copilot] error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
