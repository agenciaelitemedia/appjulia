import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "chat_conversations",
  "crm_deals",
  "support_tickets",
  "tasks",
] as const;

// support_tickets uses requester_client_id, not client_id
const CLIENT_COL: Record<string, string> = {
  support_tickets: "requester_client_id",
};

function normName(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, serviceKey);

    const body = await req.json().catch(() => ({}));
    const clientId = body?.client_id != null ? String(body.client_id) : null;
    const dryRun = body?.dry_run === true;
    const tablesArg: string[] = Array.isArray(body?.tables) && body.tables.length > 0
      ? body.tables.filter((t: string) => (TABLES as readonly string[]).includes(t))
      : [...TABLES];

    if (!clientId) {
      return new Response(JSON.stringify({ error: "client_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Carrega usuários do banco externo via db-query
    const { data: usersResp, error: usersErr } = await supabase.functions.invoke("db-query", {
      body: {
        action: "raw",
        data: {
          query: `SELECT id, name FROM users WHERE client_id = $1 AND name IS NOT NULL`,
          params: [Number(clientId)],
        },
      },
    });
    if (usersErr) throw usersErr;

    const users: Array<{ id: number; name: string }> = usersResp?.data || [];

    // 2) Map normalizado por nome, mantendo apenas matches únicos.
    const counts = new Map<string, number>();
    const map = new Map<string, number>();
    for (const u of users) {
      const key = normName(u.name);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!map.has(key)) map.set(key, Number(u.id));
    }
    // remove ambíguos
    for (const [k, c] of counts.entries()) {
      if (c > 1) map.delete(k);
    }

    const report: Record<string, { scanned: number; updated: number; ambiguous_skipped: number; no_match: number }> = {};

    for (const table of tablesArg) {
      const clientCol = CLIENT_COL[table] || "client_id";
      const r = { scanned: 0, updated: 0, ambiguous_skipped: 0, no_match: 0 };

      // pagina linhas a backfillar (assigned_to preenchido, id ainda nulo)
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: rows, error: selErr } = await supabase
          .from(table)
          .select("id, assigned_to")
          .eq(clientCol, clientId)
          .is("assigned_user_id", null)
          .not("assigned_to", "is", null)
          .neq("assigned_to", "")
          .range(from, from + pageSize - 1);
        if (selErr) throw selErr;
        if (!rows || rows.length === 0) break;
        r.scanned += rows.length;

        // agrupa por id alvo para atualizar em lote
        const idsByUser = new Map<number, string[]>();
        for (const row of rows as any[]) {
          const key = normName(row.assigned_to);
          if (!key) { r.no_match++; continue; }
          if (counts.get(key) && (counts.get(key) as number) > 1) { r.ambiguous_skipped++; continue; }
          const uid = map.get(key);
          if (!uid) { r.no_match++; continue; }
          const list = idsByUser.get(uid) || [];
          list.push(row.id);
          idsByUser.set(uid, list);
        }

        if (!dryRun) {
          for (const [uid, ids] of idsByUser.entries()) {
            // update em chunks de 500 para evitar URLs longas
            for (let i = 0; i < ids.length; i += 500) {
              const chunk = ids.slice(i, i + 500);
              const { error: updErr } = await supabase
                .from(table)
                .update({ assigned_user_id: uid })
                .in("id", chunk);
              if (updErr) throw updErr;
              r.updated += chunk.length;
            }
          }
        } else {
          for (const ids of idsByUser.values()) r.updated += ids.length;
        }

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      report[table] = r;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        client_id: clientId,
        dry_run: dryRun,
        users_loaded: users.length,
        unique_names: map.size,
        report,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[assigned-user-id-backfill] error", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});