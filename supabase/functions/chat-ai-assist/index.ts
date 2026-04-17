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

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { conversation_id, mode } = await req.json();
    if (!conversation_id || !["summary", "suggest", "sentiment"].includes(mode)) {
      return json({ error: "conversation_id and valid mode required" }, 400);
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

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
        model: "google/gemini-2.5-flash",
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
