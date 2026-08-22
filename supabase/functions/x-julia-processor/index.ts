// ============================================
// x-julia-processor — worker da fila durável de entrada do X-Julia
//
// Retira um lote de itens de xj_inbound_queue (trava por linha via RPC
// xj_pick_inbound, FOR UPDATE SKIP LOCKED), entrega cada um ao x-julia-engine e
// registra o resultado. Falha => nova tentativa com backoff; estourou o limite
// de tentativas => 'dead' (DLQ) para inspeção/reprocesso manual.
//
// Chamado por pg_cron (chave de serviço) — nunca pelo navegador.
// ============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalSecret, XJ_GUARD_HEADERS } from "../_shared/x-julia/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": XJ_GUARD_HEADERS,
};

/** Espera entre tentativas, em minutos, pela ordem da tentativa. */
const BACKOFF_MINUTES = [1, 3, 10, 30, 60];
const BATCH_LIMIT = 20;
const CONCURRENCY = 5;
const STALE_LOCK_MINUTES = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = requireInternalSecret(req);
  if (denied) return json({ error: denied.error }, denied.status);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const workerId = `proc-${crypto.randomUUID().slice(0, 8)}`;
  const stats = { picked: 0, done: 0, retried: 0, dead: 0, released: 0 };

  try {
    // 1) devolve à fila o que ficou travado por um isolate morto
    const { data: released } = await supabase.rpc("xj_release_stale_inbound", {
      p_minutes: STALE_LOCK_MINUTES,
    });
    stats.released = Number(released ?? 0);

    // 2) retira o lote travando cada linha
    const { data: items, error: pickErr } = await supabase.rpc("xj_pick_inbound", {
      p_worker_id: workerId,
      p_limit: BATCH_LIMIT,
    });
    if (pickErr) throw pickErr;
    const batch = (items ?? []) as Array<Record<string, unknown>>;
    stats.picked = batch.length;
    if (!batch.length) return json({ ok: true, worker_id: workerId, ...stats });

    // 3) entrega ao motor, com concorrência limitada
    const processOne = async (item: Record<string, unknown>) => {
      const attempts = Number(item.attempts ?? 1);
      const maxAttempts = Number(item.max_attempts ?? 5);
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/x-julia-engine`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify({ action: "run", data: item.payload ?? {} }),
        });
        const bodyText = await res.text().catch(() => "");
        if (!res.ok) throw new Error(`motor HTTP ${res.status}: ${bodyText.slice(0, 300)}`);

        await supabase
          .from("xj_inbound_queue")
          .update({
            status: "done",
            locked_at: null,
            worker_id: null,
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", item.id);
        stats.done++;
      } catch (err) {
        const message = String((err as Error)?.message ?? err).slice(0, 500);
        const exhausted = attempts >= maxAttempts;
        const waitMinutes = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
        await supabase
          .from("xj_inbound_queue")
          .update({
            status: exhausted ? "dead" : "pending",
            locked_at: null,
            worker_id: null,
            error_message: message,
            run_at: exhausted
              ? new Date().toISOString()
              : new Date(Date.now() + waitMinutes * 60_000).toISOString(),
          })
          .eq("id", item.id);
        if (exhausted) stats.dead++;
        else stats.retried++;
        console.error(`[x-julia-processor] item ${item.id} falhou (tentativa ${attempts}):`, message);
      }
    };

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      await Promise.allSettled(batch.slice(i, i + CONCURRENCY).map(processOne));
    }

    return json({ ok: true, worker_id: workerId, ...stats });
  } catch (error) {
    console.error("[x-julia-processor] erro:", error);
    return json({ error: (error as Error).message, ...stats }, 500);
  }
});
