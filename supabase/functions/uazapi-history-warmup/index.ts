// ============================================
// UaZapi History Warmup
// Calls /message/history-sync for each number to instruct
// the UaZapi server to download history. Runs in batches.
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizePhone(raw: string): string {
  return (raw || '').replace(/@.*/, '').replace(/[^\d]/g, '');
}

function isGroupChatId(value: unknown): boolean {
  return typeof value === 'string' && value.includes('@g.us');
}

async function warmOne(evoUrl: string, token: string, phone: string, count: number) {
  const url = `${evoUrl.replace(/\/$/, '')}/message/history-sync`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': token },
      body: JSON.stringify({ number: `${phone}@s.whatsapp.net`, count }),
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return { phone, ok: false, error: `HTTP ${resp.status}: ${txt.slice(0, 200)}` };
    }
    return { phone, ok: true };
  } catch (e) {
    return { phone, ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { evo_url, evo_token, numbers, count = 100, batch_size = 5 } = await req.json();

    if (!evo_url || !evo_token || !Array.isArray(numbers) || numbers.length === 0) {
      return respond({ error: 'evo_url, evo_token and numbers[] are required' }, 400);
    }

    const phones = numbers
      .filter((n: unknown) => !isGroupChatId(n))
      .map(normalizePhone)
      .filter((n) => n.length >= 8);
    const results: Array<{ phone: string; ok: boolean; error?: string }> = [];

    for (let i = 0; i < phones.length; i += batch_size) {
      const batch = phones.slice(i, i + batch_size);
      const batchResults = await Promise.all(
        batch.map((p) => warmOne(evo_url, evo_token, p, count)),
      );
      results.push(...batchResults);
    }

    const okCount = results.filter((r) => r.ok).length;
    return respond({
      ok: true,
      total: phones.length,
      success: okCount,
      failed: phones.length - okCount,
      results,
    });
  } catch (err) {
    console.error('[uazapi-history-warmup] Error:', err);
    return respond({ error: (err as Error).message }, 500);
  }
});