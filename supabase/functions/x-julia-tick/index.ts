// ============================================
// x-julia-tick — gatilho público mínimo do X-Julia (chamado pelo pg_cron)
//
// O pg_cron só consegue enviar headers literais, então não pode portar o segredo
// interno. Esta função é a única porta aberta: não recebe nem devolve dados de
// negócio; apenas aciona, server-to-server com a chave de serviço, o worker da
// fila de entrada e o disparador de follow-ups.
// ============================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGETS = ["x-julia-processor", "x-julia-followup-runner"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const internalSecret = (Deno.env.get("XJ_INTERNAL_SECRET") ?? "").trim();

  const results: Record<string, unknown> = {};

  await Promise.allSettled(
    TARGETS.map(async (fn) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            ...(internalSecret ? { "x-xj-internal-secret": internalSecret } : {}),
          },
          body: JSON.stringify({ source: "x-julia-tick" }),
        });
        const text = await res.text().catch(() => "");
        results[fn] = { status: res.status, body: text.slice(0, 300) };
      } catch (err) {
        results[fn] = { error: String((err as Error)?.message ?? err) };
      }
    }),
  );

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
