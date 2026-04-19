// AI assistant for chat: summarize conversation or suggest reply.
// Uses Lovable AI Gateway (LOVABLE_API_KEY).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getModel(clientId: string | null, feature: string): Promise<string> {
  if (!clientId) return DEFAULT_MODEL;
  const { data } = await supabase
    .from("client_ai_model_config")
    .select("model")
    .eq("client_id", clientId)
    .eq("feature", feature)
    .maybeSingle();
  return data?.model ?? DEFAULT_MODEL;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { conversation_id, mode, after_ts, client_id } = body;
    const validModes = ["summary", "suggest", "sentiment", "full_summary"];
    if (!conversation_id || !validModes.includes(mode)) {
      return json({ error: "conversation_id and valid mode required", received: { conversation_id, mode } }, 200);
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const model = await getModel(client_id ?? null, "chat_assist");

    if (mode === "full_summary") {
      let query = supabase
        .from("chat_messages")
        .select("text, from_me, sender_name, timestamp, type")
        .eq("conversation_id", conversation_id)
        .order("timestamp", { ascending: true })
        .limit(200);

      if (after_ts) {
        query = query.gt("timestamp", after_ts);
      }

      const { data: msgs } = await query;
      const filtered = (msgs || []).filter((m) => m.text);
      if (filtered.length === 0) return json({ error: "Sem mensagens para resumir" }, 400);

      const transcript = filtered
        .map((m) => `${m.from_me ? "Atendente" : "Cliente"} (${m.sender_name || ""}): ${m.text}`)
        .join("\n");

      const first_message_ts = filtered[0]?.timestamp ?? null;
      const last_message_ts = filtered[filtered.length - 1]?.timestamp ?? null;
      const message_count = filtered.length;

      const prompt = `Analise a conversa abaixo e responda APENAS com JSON válido no formato:
{
  "sentiment": "Sentimento: [positivo/neutro/negativo/frustrado] — [explicação curta de 1 linha]",
  "summary": "• bullet 1\\n• bullet 2\\n• bullet 3",
  "atendimento": "Como foi o atendimento: [análise curta de 1-2 linhas sobre qualidade, tempo de resposta, cordialidade]"
}
Faça o resumo das conversas até agora. Pode sugerir melhorias.

Conversa:
${transcript}`;

      const resp = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "user", content: prompt },
          ],
        }),
      });

      if (resp.status === 429) return json({ error: "Limite de uso da IA atingido." }, 429);
      if (resp.status === 402) return json({ error: "Créditos da IA esgotados." }, 402);
      if (!resp.ok) {
        const t = await resp.text();
        return json({ error: "AI error", detail: t }, 500);
      }

      const aiData = await resp.json();
      const raw = aiData?.choices?.[0]?.message?.content ?? "{}";
      let parsed: Record<string, string> = {};
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        parsed = { summary: raw, sentiment: "", atendimento: "" };
      }

      return json({
        sentiment: parsed.sentiment ?? "",
        summary: parsed.summary ?? raw,
        atendimento: parsed.atendimento ?? "",
        first_message_ts,
        last_message_ts,
        message_count,
      });
    }

    // Existing modes: summary, suggest, sentiment
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("text, from_me, sender_name, timestamp, type")
      .eq("conversation_id", conversation_id)
      .order("timestamp", { ascending: true })
      .limit(80);

    const transcript = (msgs || [])
      .filter((m) => m.text)
      .map((m) => `${m.from_me ? "Atendente" : "Cliente"} (${m.sender_name || ""}): ${m.text}`)
      .join("\n");

    if (!transcript) return json({ result: "Conversa sem mensagens." });

    const systemByMode: Record<string, string> = {
      summary: "Você é um assistente que resume conversas de atendimento ao cliente em 3-5 bullets curtos em português, destacando: motivo do contato, status atual, próximos passos pendentes.",
      suggest: "Você é um assistente de atendimento. Sugira UMA resposta curta, cordial e profissional em português para o atendente enviar agora ao cliente, com base no histórico. Retorne apenas o texto da resposta, sem prefixos.",
      sentiment: "Analise o sentimento geral do cliente na conversa. Responda em UMA linha em português: 'Sentimento: [positivo/neutro/negativo/frustrado] — [explicação curta]'.",
    };

    const resp = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemByMode[mode] },
          { role: "user", content: transcript },
        ],
      }),
    });

    if (resp.status === 429) return json({ error: "Limite de uso da IA atingido. Tente em instantes." }, 429);
    if (resp.status === 402) return json({ error: "Créditos da IA esgotados. Adicione créditos no workspace." }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: "AI error", detail: t }, 500);
    }
    const data = await resp.json();
    const result = data?.choices?.[0]?.message?.content ?? "";
    return json({ result, mode });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
