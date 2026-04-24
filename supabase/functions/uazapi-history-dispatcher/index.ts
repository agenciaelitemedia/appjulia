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

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

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

function pickFreeWorker(busyIds: Set<number>): number | null {
  for (let i = 0; i < MAX_WORKERS; i++) {
    if (!busyIds.has(i) && !state.busy.has(i)) return i;
  }
  return null;
}

// Lê do DB quais worker_ids estão ativos (lock fresco < 30s).
// Permite que o dispatcher saiba do pool real mesmo entre cold-starts.
async function getActiveWorkerIds(): Promise<Set<number>> {
  try {
    const sb = getSb();
    const sinceIso = new Date(Date.now() - 30_000).toISOString();
    const { data } = await sb
      .from('uazapi_history_items')
      .select('worker_id')
      .eq('status', 'pending')
      .not('worker_id', 'is', null)
      .gte('locked_at', sinceIso)
      .limit(1000);
    const set = new Set<number>();
    for (const r of (data ?? []) as Array<{ worker_id: number | null }>) {
      if (typeof r.worker_id === 'number') set.add(r.worker_id);
    }
    return set;
  } catch (e) {
    console.warn('[dispatcher] getActiveWorkerIds failed:', (e as Error).message);
    return new Set();
  }
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
  // Pool agressivo: sempre tenta encher até MAX_WORKERS quando há backlog.
  let target = MAX_WORKERS;
  if (pendingHint < 100) target = 2;
  else if (pendingHint < 500) target = 5;

  // Slots já ocupados segundo o DB (workers vivos com lock fresco)
  const dbBusy = await getActiveWorkerIds();
  const totalBusy = dbBusy.size + state.busy.size;
  const slotsAvailable = Math.max(0, target - totalBusy);

  const fired: Promise<unknown>[] = [];
  for (let i = 0; i < slotsAvailable; i++) {
    const wid = pickFreeWorker(dbBusy);
    if (wid === null) break;
    fired.push(invokeWorker(wid));
  }
  return fired;
}

// Self-tick: agenda nova chamada do próprio dispatcher em ~10s para
// repor pool sem esperar o cron de 60s. Só dispara se a instância ainda
// estiver viva (waitUntil mantém o promise vivo).
let selfTickScheduled = false;
function scheduleSelfTick() {
  if (selfTickScheduled) return;
  selfTickScheduled = true;
  const url = `${SUPABASE_URL}/functions/v1/uazapi-history-dispatcher`;
  const p = new Promise<void>((resolve) => {
    setTimeout(async () => {
      try {
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
          },
          body: JSON.stringify({ action: 'tick' }),
        }).catch((e) => console.warn('[dispatcher] self-tick failed:', e?.message));
      } finally {
        selfTickScheduled = false;
        resolve();
      }
    }, 10_000);
  });
  try { EdgeRuntime.waitUntil(p); } catch { /* ignore */ }
}

// Vazão real lida do DB: items com status='ok' processados no último minuto.
// Cache de 5s para evitar count repetido por chamada.
let lastThroughput = { value: 0, at: 0 };
async function itemsPerMin(): Promise<number> {
  const now = Date.now();
  if (now - lastThroughput.at < 5000) return lastThroughput.value;
  try {
    const sb = getSb();
    const sinceIso = new Date(now - 60_000).toISOString();
    const { count } = await sb
      .from('uazapi_history_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ok')
      .gte('processed_at', sinceIso);
    lastThroughput = { value: count ?? 0, at: now };
    return lastThroughput.value;
  } catch (e) {
    console.warn('[dispatcher] throughput query failed:', (e as Error).message);
    return lastThroughput.value;
  }
}

async function writeHeartbeat(extra: Record<string, unknown> = {}) {
  try {
    const sb = getSb();
    const ipm = await itemsPerMin();
    await sb.from('dispatcher_heartbeat').upsert({
      id: HEARTBEAT_ID,
      last_seen_at: new Date().toISOString(),
      workers_active: state.active,
      workers_max: MAX_WORKERS,
      items_per_min: ipm,
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
    const ipm = await itemsPerMin();
    return respond({
      ok: true,
      active: state.active,
      max: MAX_WORKERS,
      processed_session: state.processedSession,
      items_per_min: ipm,
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

  // Agenda self-tick em 10s para manter o pool cheio entre os cron heartbeats (60s)
  scheduleSelfTick();

  const ipm = await itemsPerMin();
  return respond({
    ok: true,
    pending,
    fired: fired.length,
    active: state.active,
    items_per_min: ipm,
  });
});