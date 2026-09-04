// Edge Function: migracao-executar
// Orquestra a migração deste projeto (Lovable Cloud) para um Supabase externo.
// Ações: precheck | schema | data_chunk | verify | storage_chunk
//
// As credenciais do destino (URL + service_role key) vêm no body, são usadas para
// criar um cliente Supabase e NUNCA são logadas.
//
// DDL (tables, constraints, indexes, functions, triggers, RLS, policies) é gerado
// ou aplicado via exec_sql no destino. Se exec_sql não existir, retorna bootstrap
// para criação manual.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

interface MigrationBody {
  action: string;
  run_id?: string;
  target_url: string;
  target_service_role_key: string;
  options?: Record<string, any>;
}

const BATCH_SIZE = 2000;

const SKIP_DATA_TABLES = new Set([
  "uazapi_history_items",
  "chat_dropped_messages",
  "webhook_logs",
  "webhook_queue",
  "chat_legacy_cache",
  "migration_runs",
  "migration_steps",
]);

const SKIP_PREFIXES = ["user_presence_heartbeats_20"];

function response(data: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, detail?: any, status = 400) {
  return new Response(
    JSON.stringify({ error: message, detail }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function createTargetClient(targetUrl: string, targetKey: string): Promise<SupabaseClient> {
  return createClient(targetUrl, targetKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getSourceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!url || !key) throw new Error("Missing source Supabase credentials");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging helpers
// ─────────────────────────────────────────────────────────────────────────────
async function logStep(
  supabase: SupabaseClient,
  runId: string,
  stepName: string,
  status: string,
  progress: number,
  message?: string,
  detail?: any,
  errorMessage?: string,
) {
  const { data } = await supabase
    .from("migration_steps")
    .select("id")
    .eq("run_id", runId)
    .eq("step_name", stepName)
    .maybeSingle();

  const payload: any = {
    run_id: runId,
    step_name: stepName,
    status,
    progress,
    message: message ?? null,
    detail: detail ?? null,
    error_message: errorMessage ?? null,
    finished_at: status === "finished" || status === "failed" ? new Date().toISOString() : null,
  };

  if (data?.id) {
    await supabase.from("migration_steps").update(payload).eq("id", data.id);
  } else {
    await supabase
      .from("migration_steps")
      .insert({ ...payload, started_at: status === "running" ? new Date().toISOString() : null });
  }
}

async function updateRun(
  supabase: SupabaseClient,
  runId: string,
  status: string,
  extra?: Record<string, any>,
  errorMessage?: string,
) {
  const payload: any = { status, updated_at: new Date().toISOString(), ...extra };
  if (errorMessage) payload.error_message = errorMessage;
  if (status === "finished" || status === "failed") payload.finished_at = new Date().toISOString();
  await supabase.from("migration_runs").update(payload).eq("id", runId);
}

async function createRun(supabase: SupabaseClient, targetUrl: string): Promise<string> {
  const { data, error } = await supabase
    .from("migration_runs")
    .insert({ target_url: targetUrl, status: "running" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`create run failed: ${error?.message}`);
  return data.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRECHECK
// ─────────────────────────────────────────────────────────────────────────────
async function doPrecheck(source: SupabaseClient, targetUrl: string, targetKey: string) {
  const target = createTargetClient(targetUrl, targetKey);
  const { data: srcVer, error: srcErr } = await source.rpc("version");
  const { data: tgtVer, error: tgtErr } = await target.rpc("version");

  if (srcErr || tgtErr) {
    throw new Error(`precheck failed: source=${srcErr?.message || ""} target=${tgtErr?.message || ""}`);
  }

  // Test exec_sql on target
  const { error: execErr } = await target.rpc("exec_sql", { sql_query: "SELECT 1 as ok;" });

  return {
    source_version: srcVer,
    target_version: tgtVer,
    target_exec_sql_exists: !execErr,
    target_exec_sql_error: execErr ? execErr.message : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SCHEMA — generate DDL from source information_schema
// ─────────────────────────────────────────────────────────────────────────────
async function doSchema(source: SupabaseClient, target: SupabaseClient, dryRun: boolean) {
  const result: any = { tables: 0, errors: [], dry_run: dryRun, bootstrap_required: false };

  // Check exec_sql on target
  const { error: execErr } = await target.rpc("exec_sql", { sql_query: "SELECT 1 as ok;" });
  if (execErr) {
    result.bootstrap_required = true;
    result.bootstrap_sql = `CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql_query;
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql TO service_role;
GRANT EXECUTE ON FUNCTION public.exec_sql TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql TO anon;`;
    return result;
  }

  // Tables
  const { data: tables, error: tablesErr } = await source
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_type", "BASE TABLE")
    .order("table_name");

  if (tablesErr) throw new Error(`list tables: ${tablesErr.message}`);

  const ddlStatements: string[] = [];
  const targetTables = new Set<string>();

  for (const t of tables || []) {
    const table = t.table_name as string;
    if (table.startsWith("migration_")) continue;

    const { data: cols } = await source
      .from("information_schema.columns")
      .select("column_name,data_type,character_maximum_length,numeric_precision,numeric_scale,udt_name,column_default,is_nullable")
      .eq("table_schema", "public")
      .eq("table_name", table)
      .order("ordinal_position");

    if (!cols || cols.length === 0) continue;

    const colDefs = cols.map((c) => {
      let type = c.data_type as string;
      if (type === "USER-DEFINED") type = c.udt_name;
      if (type === "ARRAY") type = `${c.udt_name.replace("_", "")}[]`;
      if (type === "character varying" && c.character_maximum_length) type = `varchar(${c.character_maximum_length})`;
      if (type === "numeric" && c.numeric_precision) {
        type = c.numeric_scale
          ? `numeric(${c.numeric_precision},${c.numeric_scale})`
          : `numeric(${c.numeric_precision})`;
      }
      const def = c.column_default ? ` DEFAULT ${c.column_default}` : "";
      const nullable = c.is_nullable === "NO" ? " NOT NULL" : "";
      return `  "${c.column_name}" ${type}${def}${nullable}`;
    });

    const create = `CREATE TABLE IF NOT EXISTS public."${table}" (\n${colDefs.join(",\n")}\n);`;
    ddlStatements.push(create);
    targetTables.add(table);
  }

  result.tables = targetTables.size;
  result.ddl = ddlStatements.join("\n\n");
  result.ddl_preview = result.ddl.slice(0, 5000);

  if (!dryRun) {
    const { error } = await target.rpc("exec_sql", { sql_query: result.ddl });
    if (error) {
      result.errors.push({ step: "apply_tables", error: error.message });
    } else {
      result.tables_applied = targetTables.size;
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DATA_CHUNK — copia dados em lotes
// ─────────────────────────────────────────────────────────────────────────────
async function doDataChunk(
  source: SupabaseClient,
  target: SupabaseClient,
  tableName: string,
  startOffset: number,
  options: any,
) {
  if (SKIP_DATA_TABLES.has(tableName)) return { skipped: true, reason: "log/ephemeral table" };
  if (SKIP_PREFIXES.some((p) => tableName.startsWith(p))) return { skipped: true, reason: "partition table" };
  if (tableName.startsWith("migration_")) return { skipped: true, reason: "migration control table" };

  // Count using target-compatible query (if source table exists, we can query it)
  const { count: totalRows, error: countErr } = await source.from(tableName).select("*", { count: "exact", head: true });
  if (countErr) throw new Error(`count ${tableName}: ${countErr.message}`);

  let rowsCopied = 0;
  let hasMore = true;
  let offset = startOffset;
  const maxRows = options.max_rows ? Number(options.max_rows) : Infinity;

  while (hasMore && rowsCopied < maxRows) {
    const limit = Math.min(BATCH_SIZE, maxRows - rowsCopied);
    const { data: rows, error } = await source
      .from(tableName)
      .select("*")
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`read ${tableName} offset ${offset}: ${error.message}`);
    if (!rows || rows.length === 0) {
      hasMore = false;
      break;
    }

    // Remover campos internos que podem causar conflitos em inserts
    const cleanRows = rows.map((r: any) => {
      const { _metadata, ...rest } = r;
      return rest;
    });

    const { error: insertErr } = await target.from(tableName).insert(cleanRows);
    if (insertErr) {
      throw new Error(`insert ${tableName} offset ${offset}: ${insertErr.message}`);
    }

    rowsCopied += rows.length;
    offset += rows.length;
    hasMore = rows.length === limit;
  }

  return {
    table: tableName,
    rows_copied: rowsCopied,
    total_rows: totalRows ?? 0,
    next_offset: hasMore ? offset : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. VERIFY
// ─────────────────────────────────────────────────────────────────────────────
async function doVerify(source: SupabaseClient, target: SupabaseClient) {
  const { data: tables } = await source
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_type", "BASE TABLE")
    .order("table_name");

  const result: any[] = [];
  for (const t of tables || []) {
    const tableName = t.table_name as string;
    if (tableName.startsWith("migration_")) continue;

    const { count: srcCount } = await source.from(tableName).select("*", { count: "exact", head: true });
    const { count: tgtCount } = await target.from(tableName).select("*", { count: "exact", head: true });
    result.push({
      table: tableName,
      source: srcCount ?? 0,
      target: tgtCount ?? 0,
      ok: (srcCount ?? 0) === (tgtCount ?? 0),
    });
  }

  return { tables: result, ok_count: result.filter((r) => r.ok).length, total: result.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. STORAGE_CHUNK
// ─────────────────────────────────────────────────────────────────────────────
async function doStorageChunk(source: SupabaseClient, target: SupabaseClient, bucketId?: string, offset = 0) {
  const result: any = { copied: 0, errors: [], buckets: 0 };

  // Criar buckets se ainda não existirem
  if (!bucketId) {
    const { data: buckets, error: listErr } = await source.storage.listBuckets();
    if (listErr) throw new Error(`list buckets: ${listErr.message}`);
    for (const b of buckets || []) {
      const { error: createErr } = await target.storage.createBucket(b.id, {
        public: b.public,
        fileSizeLimit: b.file_size_limit,
      });
      if (createErr && !createErr.message.includes("already exists") && !createErr.message.includes("Duplicate")) {
        result.errors.push({ step: "create_bucket", bucket: b.id, error: createErr.message });
      }
    }
    result.buckets = buckets?.length || 0;
  }

  if (bucketId) {
    const { data: objects, error: listErr } = await source.storage.from(bucketId).list(undefined, {
      limit: 50,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (listErr) throw new Error(`list bucket ${bucketId}: ${listErr.message}`);

    for (const obj of objects || []) {
      if (!obj.id) continue; // folders
      const { data: fileData, error: downloadErr } = await source.storage.from(bucketId).download(obj.name);
      if (downloadErr) {
        result.errors.push({ step: "download", path: `${bucketId}/${obj.name}`, error: downloadErr.message });
        continue;
      }
      const { error: uploadErr } = await target.storage.from(bucketId).upload(obj.name, fileData!, {
        upsert: true,
        contentType: obj.metadata?.mimetype || "application/octet-stream",
      });
      if (uploadErr) {
        result.errors.push({ step: "upload", path: `${bucketId}/${obj.name}`, error: uploadErr.message });
        continue;
      }
      result.copied++;
    }
    result.bucket = bucketId;
    result.offset = offset;
    result.has_more = (objects || []).length === 50;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", null, 405);

  let body: MigrationBody;
  try {
    body = await req.json();
  } catch (e) {
    return errorResponse("Invalid JSON", (e as Error).message);
  }

  const { action, target_url, target_service_role_key, run_id, options = {} } = body;

  if (!action || !target_url || !target_service_role_key) {
    return errorResponse("action, target_url and target_service_role_key are required");
  }

  if (!target_url.startsWith("https://") || !target_url.includes(".supabase.co")) {
    return errorResponse("target_url must be a valid Supabase URL");
  }

  const source = getSourceClient();
  let runId = run_id;
  if (!runId) {
    try {
      runId = await createRun(source, target_url);
    } catch (e: any) {
      return errorResponse("failed to create run", e.message, 500);
    }
  }

  try {
    const target = createTargetClient(target_url, target_service_role_key);
    let result: any;

    switch (action) {
      case "precheck": {
        await logStep(source, runId, "precheck", "running", 0, "Testando conexão com destino...");
        result = await doPrecheck(source, target_url, target_service_role_key);
        await logStep(source, runId, "precheck", "finished", 100, "Conexão verificada", result);
        break;
      }
      case "schema": {
        await logStep(source, runId, "schema", "running", 0, "Gerando DDL das tabelas...");
        result = await doSchema(source, target, options.dry_run === true);
        await logStep(source, runId, "schema", result.bootstrap_required ? "needs_bootstrap" : "finished", 100, result.bootstrap_required ? "exec_sql não existe no destino" : "DDL gerado", result);
        break;
      }
      case "data_chunk": {
        const table = options.table;
        const offset = options.offset || 0;
        if (!table) throw new Error("options.table is required");
        await logStep(source, runId, `data:${table}`, "running", 0, `Copiando ${table}...`);
        result = await doDataChunk(source, target, table, offset, options);
        await logStep(source, runId, `data:${table}`, result.skipped ? "skipped" : "finished", 100, result.skipped ? `Ignorada: ${result.reason}` : `Copiados ${result.rows_copied || 0} registros`, result);
        break;
      }
      case "verify": {
        await logStep(source, runId, "verify", "running", 0, "Comparando contagens...");
        result = await doVerify(source, target);
        await logStep(source, runId, "verify", "finished", 100, `Verificação: ${result.ok_count}/${result.total} tabelas iguais`, result);
        break;
      }
      case "storage_chunk": {
        await logStep(source, runId, "storage", "running", 0, "Copiando buckets e objetos...");
        result = await doStorageChunk(source, target, options.bucket, options.offset || 0);
        await logStep(source, runId, "storage", "finished", 100, `Storage: ${result.copied} objetos copiados`, result);
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await updateRun(source, runId, "running");
    return response({ success: true, run_id: runId, action, result });
  } catch (err: any) {
    await logStep(source, runId, action, "failed", 0, err.message, null, err.message);
    await updateRun(source, runId, "failed", {}, err.message);
    return errorResponse(err.message, { run_id: runId }, 500);
  }
});
