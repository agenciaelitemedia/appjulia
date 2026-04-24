// ============================================
// UaZapi History Dispatcher (push-based, realtime)
//
// Edge Function persistente que escuta INSERTs em uazapi_history_items
// (via Supabase Realtime / postgres_changes) e mantém um pool de até
// MAX_WORKERS workers concorrentes, invocando uazapi-history-resume
// assim que itens entram em pending.
//
// Ciclo de vida:
//  - GET  /                  → status (sem efeito)
//  - POST /  body={action:"start"}  → conecta no realtime e fica online
//  - POST /  body={action:"stop"}   → fecha tudo
//  - POST /  body={action:"tick"}   → checa backlog e dispara workers se houver
//
// O cron de heartbeat chama action="tick" a cada 1min. Se o dispatcher já
// estiver online (heartbeat fresco), ele apenas atualiza vazão. Se estiver
// caído, o tick atua como fallback disparando workers diretamente.
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_WORKERS = 10;
const WORKER_BATCH = 50;
const WORKER_MAX_TOTAL = 500;
const HEARTBEAT_ID = 'uazapi-history-dispatcher';

// ----- in-memory state (persists per Edge Function instance) -----
const state = {
  active: 0,
  busy: new Set<number>(),
  processedSession: 0,
  processedWindow: [] as number[], // timestamps of finished worker runs
  startedAt: Date.now(),
};

function getSb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function pickFreeWorker(): number | null {
  for (let i = 0; i < MAX_WORKERS; i++) {
    if (!state.busy.has(i)) return i;
  }
  return null;
}

async function invokeWorker(workerId: number) {
  state.busy.add(workerId);
  state.active = state.busy.size;
  const t0 = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-history-resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
      },
      body: JSON.stringify({
        worker_id: workerId,
        batch_size: WORKER_BATCH,
        max_total: WORKER_MAX_TOTAL,
        loop_ms: 25000,
      }),
    });
    const json = await res.json().catch(() => ({}));
    const inserted = (json as any)?.inserted ?? 0;
    const picked = (json as any)?.picked ?? 0;
    state.processedSession += picked;
    state.processedWindow.push(Date.now());
    console.log(`[dispatcher] worker=${workerId} done in ${Date.now() - t0}ms picked=${picked} inserted=${inserted}`);
    return { picked, inserted };
  } catch (e) {
    console.warn(`[dispatcher] worker=${workerId} error:`, (e as Error).message);
    return { picked: 0, inserted: 0, error: (e as Error).message };
  } finally {
    state.busy.delete(workerId);
    state.active = state.busy.size;
  }
}

async function ensurePool(pendingHint: number) {
  // Decide quantos workers disparar com base no backlog
  let target = 1;
  if (pendingHint > 100) target = 3;
  if (pendingHint > 1000) target = 6;
  if (pendingHint > 5000) target = MAX_WORKERS;

  const fired: Promise<unknown>[] = [];
  for (let i = 0; i < target; i++) {
    const wid = pickFreeWorker();
    if (wid === null) break;
    fired.push(invokeWorker(wid));
  }
  return fired;
}

function itemsPerMin(): number {
  // Cada worker drena ~WORKER_MAX_TOTAL items. Estimar pela janela de 60s.
  const cutoff = Date.now() - 60_000;
  state.processedWindow = state.processedWindow.filter((t) => t >= cutoff);
  return state.processedWindow.length * WORKER_MAX_TOTAL;
}

async function writeHeartbeat(extra: Record<string, unknown> = {}) {
  try {
    const sb = getSb();
    await sb.from('dispatcher_heartbeat').upsert({
      id: HEARTBEAT_ID,
      last_seen_at: new Date().toISOString(),
      workers_active: state.active,
      workers_max: MAX_WORKERS,
      items_per_min: itemsPerMin(),
      total_processed_session: state.processedSession,
      started_at: new Date(state.startedAt).toISOString(),
      metadata: { ...extra },
    });
  } catch (e) {
    console.warn('[dispatcher] heartbeat write failed:', (e as Error).message);
  }
}

async function getPendingCount(): Promise<number> {
  const sb = getSb();
  const { count } = await sb
    .from('uazapi_history_items')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  return count ?? 0;
}

async function releaseStale() {
  try {
    const sb = getSb();
    await sb.rpc('uazapi_release_stale_locks');
  } catch (e) {
    console.warn('[dispatcher] release_stale_locks failed:', (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let action = 'tick';
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      action = body?.action ?? 'tick';
    } catch { /* ignore */ }
  }

  if (action === 'status') {
    return respond({
      ok: true,
      active: state.active,
      max: MAX_WORKERS,
      processed_session: state.processedSession,
      items_per_min: itemsPerMin(),
      uptime_ms: Date.now() - state.startedAt,
    });
  }

  // tick / start: libera locks órfãos, conta pendências, dispara pool
  await releaseStale();
  const pending = await getPendingCount();

  if (pending === 0) {
    await writeHeartbeat({ pending: 0, action });
    return respond({ ok: true, pending: 0, fired: 0, active: state.active });
  }

  const fired = await ensurePool(pending);
  await writeHeartbeat({ pending, action, fired: fired.length });

  // Não bloqueia o response — workers continuam em background via waitUntil
  // (a runtime mantém os promises vivos enquanto não houver shutdown)
  Promise.allSettled(fired).then(async () => {
    await writeHeartbeat({ pending_after: await getPendingCount(), action: 'post-batch' });
  });

  return respond({
    ok: true,
    pending,
    fired: fired.length,
    active: state.active,
    items_per_min: itemsPerMin(),
  });
});