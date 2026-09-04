// Edge Function: migracao-executar
// Orquestra a migração deste projeto (Lovable Cloud) para um Supabase externo.
// Ações: precheck | schema | data_chunk | postschema | security | storage_chunk | verify
//
// As credenciais do destino (URL + service_role key) vêm no body, são usadas para
// criar um cliente Supabase e NUNCA são logadas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

interface MigrationBody {
  action: string;
  run_id?: string;
  target_url: string;
  target_service_role_key: string;
  options?: Record<string, any>;
}

const SOURCE_SCHEMA = "public";
const BATCH_SIZE = 5000;

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

async function createTargetClient(targetUrl: string, targetKey: string) {
  return createClient(targetUrl, targetKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getSourceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!url || !key) throw new Error("Missing source Supabase credentials");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function logStep(
  supabase: any,
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
  };

  if (data?.id) {
    await supabase.from("migration_steps").update(payload).eq("id", data.id);
  } else {
    await supabase.from("migration_steps").insert({ ...payload, started_at: status === "running" ? new Date().toISOString() : null });
  }
}

async function updateRunStatus(
  supabase: any,
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRECHECK
// ─────────────────────────────────────────────────────────────────────────────
async function doPrecheck(source: any, targetUrl: string, targetKey: string) {
  const target = await createTargetClient(targetUrl, targetKey);

  const { data: sourceVersion, error: sourceErr } = await source.rpc("version");
  const { data: targetVersion, error: targetErr } = await target.rpc("version");

  const { data: extensions, error: extErr } = await source
    .from("pg_extension")
    .select("extname")
    .order("extname");

  if (sourceErr || targetErr || extErr) {
    throw new Error(`precheck failed: ${sourceErr?.message || ""} ${targetErr?.message || ""} ${extErr?.message || ""}`);
  }

  return {
    source_version: sourceVersion,
    target_version: targetVersion,
    extensions: extensions?.map((e: any) => e.extname) || [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SCHEMA — gera DDL por introspecção e aplica no destino
// ─────────────────────────────────────────────────────────────────────────────
async function doSchema(source: any, target: any) {
  const result: any = { tables: 0, errors: [] };

  // 2.1 Extensões
  const { data: extRows } = await source
    .from("pg_extension")
    .select("extname")
    .order("extname");

  const extNames = (extRows || []).map((r: any) => r.extname).filter((n: string) =>
    ["uuid-ossp", "pgcrypto", "pg_stat_statements", "pg_trgm", "pg_cron", "pg_net"].includes(n)
  );

  const extSql = extNames.map((e: string) => `CREATE EXTENSION IF NOT EXISTS "${e}";`).join("\n");
  if (extSql) {
    const { error } = await target.rpc("exec_sql", { sql_query: extSql });
    if (error) result.errors.push({ step: "extensions", error: error.message });
  }
  result.extensions = extNames;

  // 2.2 Tabelas (CREATE TABLE ...)
  const { data: tables } = await source.rpc("get_all_tables_ddl");
  if (tables && tables.length) {
    const tableSql = tables.map((t: any) => t.ddl).join("\n\n");
    const { error } = await target.rpc("exec_sql", { sql_query: tableSql });
    if (error) result.errors.push({ step: "tables", error: error.message });
    result.tables = tables.length;
  }

  // 2.3 Sequences
  const { data: sequences } = await source.rpc("get_all_sequences_ddl");
  if (sequences && sequences.length) {
    const seqSql = sequences.map((s: any) => s.ddl).join("\n\n");
    const { error } = await target.rpc("exec_sql", { sql_query: seqSql });
    if (error) result.errors.push({ step: "sequences", error: error.message });
    result.sequences = sequences.length;
  }

  // 2.4 Funções
  const { data: functions } = await source.rpc("get_all_functions_ddl");
  if (functions && functions.length) {
    // Ordenar por dependência não é trivial; aqui aplicamos em blocos e reportamos erros.
    for (const fn of functions) {
      const { error } = await target.rpc("exec_sql", { sql_query: fn.ddl });
      if (error) result.errors.push({ step: "function", name: fn.name, error: error.message });
    }
    result.functions = functions.length;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DATA_CHUNK — copia dados em lotes de uma tabela
// ─────────────────────────────────────────────────────────────────────────────
async function doDataChunk(
  source: any,
  target: any,
  tableName: string,
  startOffset: number,
  options: any,
) {
  const skipTables = new Set([
    "uazapi_history_items",
    "chat_dropped_messages",
    "webhook_logs",
    "webhook_queue",
    "chat_legacy_cache",
    "migration_runs",
    "migration_steps",
  ]);

  // partições de heartbeat
  if (tableName.startsWith("user_presence_heartbeats_")) {
    return { skipped: true, reason: "heartbeat partition" };
  }
  if (skipTables.has(tableName)) {
    return { skipped: true, reason: "log/ephemeral table" };
  }

  const { data: countRow } = await source.rpc("get_table_count", { p_table: tableName });
  const totalRows = countRow || 0;

  let rowsCopied = 0;
  let hasMore = true;
  let offset = startOffset;

  while (hasMore) {
    const { data: rows, error } = await source.rpc("get_table_batch", {
      p_table: tableName,
      p_limit: BATCH_SIZE,
      p_offset: offset,
    });

    if (error) throw new Error(`batch read ${tableName}: ${error.message}`);
    if (!rows || rows.length === 0) {
      hasMore = false;
      break;
    }

    const { error: insertErr } = await target.from(tableName).insert(rows);
    if (insertErr) {
      // Tenta sem conflitos comuns: serialização de arrays json, uuid, etc.
      throw new Error(`insert ${tableName} offset ${offset}: ${insertErr.message}`);
    }

    rowsCopied += rows.length;
    offset += rows.length;
    hasMore = rows.length === BATCH_SIZE;
  }

  return { table: tableName, rows_copied: rowsCopied, total_rows: totalRows, next_offset: hasMore ? offset : null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. POSTSCHEMA — constraints, indexes, triggers, matviews
// ─────────────────────────────────────────────────────────────────────────────
async function doPostschema(source: any, target: any) {
  const result: any = { errors: [] };

  const { data: constraints } = await source.rpc("get_all_constraints_ddl");
  if (constraints && constraints.length) {
    const sql = constraints.map((c: any) => c.ddl).join("\n\n");
    const { error } = await target.rpc("exec_sql", { sql_query: sql });
    if (error) result.errors.push({ step: "constraints", error: error.message });
    result.constraints = constraints.length;
  }

  const { data: indexes } = await source.rpc("get_all_indexes_ddl");
  if (indexes && indexes.length) {
    const sql = indexes.map((i: any) => i.ddl).join("\n\n");
    const { error } = await target.rpc("exec_sql", { sql_query: sql });
    if (error) result.errors.push({ step: "indexes", error: error.message });
    result.indexes = indexes.length;
  }

  const { data: triggers } = await source.rpc("get_all_triggers_ddl");
  if (triggers && triggers.length) {
    for (const t of triggers) {
      const { error } = await target.rpc("exec_sql", { sql_query: t.ddl });
      if (error) result.errors.push({ step: "trigger", name: t.name, error: error.message });
    }
    result.triggers = triggers.length;
  }

  const { data: matviews } = await source.rpc("get_all_matviews_ddl");
  if (matviews && matviews.length) {
    const sql = matviews.map((m: any) => m.ddl).join("\n\n") + "\n\nREFRESH MATERIALIZED VIEW " + matviews.map((m: any) => m.name).join(";\nREFRESH MATERIALIZED VIEW ");
    const { error } = await target.rpc("exec_sql", { sql_query: sql });
    if (error) result.errors.push({ step: "matviews", error: error.message });
    result.matviews = matviews.length;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SECURITY — grants, RLS, policies
// ─────────────────────────────────────────────────────────────────────────────
async function doSecurity(source: any, target: any) {
  const result: any = { errors: [] };

  const { data: grants } = await source.rpc("get_all_grants_ddl");
  if (grants && grants.length) {
    const sql = grants.map((g: any) => g.ddl).join("\n\n");
    const { error } = await target.rpc("exec_sql", { sql_query: sql });
    if (error) result.errors.push({ step: "grants", error: error.message });
    result.grants = grants.length;
  }

  const { data: rls } = await source.rpc("get_all_rls_ddl");
  if (rls && rls.length) {
    const sql = rls.map((r: any) => r.ddl).join("\n\n");
    const { error } = await target.rpc("exec_sql", { sql_query: sql });
    if (error) result.errors.push({ step: "rls", error: error.message });
    result.rls = rls.length;
  }

  const { data: policies } = await source.rpc("get_all_policies_ddl");
  if (policies && policies.length) {
    for (const p of policies) {
      const { error } = await target.rpc("exec_sql", { sql_query: p.ddl });
      if (error) result.errors.push({ step: "policy", name: p.name, error: error.message });
    }
    result.policies = policies.length;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. STORAGE_CHUNK — buckets + objetos
// ─────────────────────────────────────────────────────────────────────────────
async function doStorageChunk(source: any, target: any, bucketId?: string, startAfter?: string) {
  const result: any = { copied: 0, errors: [] };

  // 6.1 Buckets
  if (!bucketId) {
    const { data: buckets } = await source.storage.listBuckets();
    if (buckets && buckets.length) {
      for (const b of buckets) {
        const { error } = await target.storage.createBucket(b.id, {
          public: b.public,
          fileSizeLimit: b.file_size_limit,
        });
        if (error && !error.message?.includes("already exists")) {
          result.errors.push({ step: "create_bucket", bucket: b.id, error: error.message });
        }
      }
      result.buckets = buckets.length;
    }
  }

  // 6.2 Objetos
  const bucket = bucketId || (result.buckets ? null : null);
  if (!bucket) {
    return result;
  }

  const { data: objects, error: listErr } = await source.storage.from(bucket).list(undefined, {
    limit: 100,
    offset: startAfter ? parseInt(startAfter, 10) : 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (listErr) throw new Error(`list bucket ${bucket}: ${listErr.message}`);

  for (const obj of objects || []) {
    if (!obj.id) continue; // pastas
    const { data: fileData, error: downloadErr } = await source.storage.from(bucket).download(obj.name);
    if (downloadErr) {
      result.errors.push({ step: "download", path: obj.name, error: downloadErr.message });
      continue;
    }
    const { error: uploadErr } = await target.storage.from(bucket).upload(obj.name, fileData!, {
      upsert: true,
      contentType: obj.metadata?.mimetype || "application/octet-stream",
    });
    if (uploadErr) {
      result.errors.push({ step: "upload", path: obj.name, error: uploadErr.message });
      continue;
    }
    result.copied++;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. VERIFY — contagens origem × destino
// ─────────────────────────────────────────────────────────────────────────────
async function doVerify(source: any, target: any) {
  const { data: tables } = await source.rpc("get_public_tables");
  const result: any[] = [];

  for (const t of tables || []) {
    const tableName = t.table_name;
    const { data: srcCount } = await source.rpc("get_table_count", { p_table: tableName });
    const { data: tgtCount } = await target.rpc("get_table_count", { p_table: tableName });
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
// MAIN HANDLER
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

  const source = await getSourceClient();

  let runId = run_id;
  if (!runId) {
    const { data: run, error: runErr } = await source
      .from("migration_runs")
      .insert({ target_url, status: "running" })
      .select("id")
      .single();
    if (runErr || !run) return errorResponse("failed to create run", runErr?.message, 500);
    runId = run.id;
  }

  let result: any;
  try {
    const target = await createTargetClient(target_url, target_service_role_key);

    switch (action) {
      case "precheck": {
        await logStep(source, runId, "precheck", "running", 0, "Conectando no destino...");
        result = await doPrecheck(source, target_url, target_service_role_key);
        await logStep(source, runId, "precheck", "finished", 100, "Conexão OK", result);
        break;
      }
      case "schema": {
        await logStep(source, runId, "schema", "running", 0, "Gerando e aplicando DDL...");
        result = await doSchema(source, target);
        await logStep(source, runId, "schema", "finished", 100, "Estrutura aplicada", result);
        break;
      }
      case "data_chunk": {
        const table = options.table;
        const offset = options.offset || 0;
        if (!table) throw new Error("options.table is required");
        await logStep(source, runId, `data:${table}`, "running", 0, `Copiando ${table}...`);
        result = await doDataChunk(source, target, table, offset, options);
        await logStep(source, runId, `data:${table}`, "finished", 100, `Copiados ${result.rows_copied || 0} registros`, result);
        break;
      }
      case "postschema": {
        await logStep(source, runId, "postschema", "running", 0, "Aplicando constraints, índices, triggers e matviews...");
        result = await doPostschema(source, target);
        await logStep(source, runId, "postschema", "finished", 100, "Pós-estrutura aplicada", result);
        break;
      }
      case "security": {
        await logStep(source, runId, "security", "running", 0, "Aplicando grants, RLS e policies...");
        result = await doSecurity(source, target);
        await logStep(source, runId, "security", "finished", 100, "Segurança aplicada", result);
        break;
      }
      case "storage_chunk": {
        await logStep(source, runId, "storage", "running", 0, "Copiando buckets e objetos...");
        result = await doStorageChunk(source, target, options.bucket, options.offset);
        await logStep(source, runId, "storage", "finished", 100, "Storage copiado", result);
        break;
      }
      case "verify": {
        await logStep(source, runId, "verify", "running", 0, "Verificando contagens...");
        result = await doVerify(source, target);
        await logStep(source, runId, "verify", "finished", 100, "Verificação concluída", result);
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await updateRunStatus(source, runId, "finished");
    return response({ success: true, run_id: runId, action, result });
  } catch (err: any) {
    await logStep(source, runId, action, "failed", 0, err.message, null, err.message);
    await updateRunStatus(source, runId, "failed", {}, err.message);
    return errorResponse(err.message, { run_id: runId }, 500);
  }
});
