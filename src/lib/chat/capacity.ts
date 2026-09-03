/**
 * Capacidade de atendentes (front) — usa a MESMA regra do servidor, via RPC
 * no banco (`chat_capacity_check` / `chat_agent_load_by_queue`). A UI nunca
 * recalcula limite localmente. A carga segue a mesma regra da lista de
 * conversas: apenas conversas em atendimento (`open`), não adiadas (snooze) e
 * nas filas que o atendente enxerga. Conversas antigas sem resposta contam.
 */
import { supabase } from '@/integrations/supabase/client';
import { externalDb } from '@/lib/externalDb';


/**
 * Não existe teto padrão: o atendente só tem limite quando a distribuição
 * automática do escritório está ativada E existe registro ativo em
 * chat_agent_capacity com máximo definido (> 0).
 */
export interface CapacityInfo {
  identifier: string;
  name: string | null;
  load: number;
  /** null = sem limite configurado. */
  max_concurrent: number | null;
  blocked: boolean;
  /** null = sem limite configurado. */
  slots: number | null;
  enforced: boolean;
}

export class CapacityBlockedError extends Error {
  info: CapacityInfo;
  constructor(info: CapacityInfo) {
    super(capacityBlockedMessage(info));
    this.name = 'CapacityBlockedError';
    this.info = info;
  }
}

export function capacityBlockedMessage(info: CapacityInfo): string {
  const who = info.name || 'Este atendente';
  if (!info.enforced || info.max_concurrent == null) {
    return `${who} não possui limite de atendimentos configurado.`;
  }
  return `${who} está com ${info.load}/${info.max_concurrent} atendimentos — encerre atendimentos antes de receber novos.`;
}

/** Identificador canônico do atendente (user_id em string). */
export function agentIdentifier(
  assignedUserId: number | string | null | undefined,
  assignedTo?: string | null,
): string | null {
  if (assignedUserId != null && String(assignedUserId).trim() !== '') return String(assignedUserId);
  const t = (assignedTo ?? '').trim();
  if (/^[0-9]+$/.test(t)) return t;
  return null;
}

export interface QueueAccessRow {
  user_id: number;
  queue_access: 'all' | 'specific';
  queue_ids: string[];
}

/** Allowlist de filas de todos os atendentes (fail-open: vazio = veem tudo). */
export async function fetchQueueAccessMap(
  clientId: string | number | null | undefined,
): Promise<Record<string, string[] | null>> {
  const cid = clientId != null ? String(clientId) : '';
  if (!cid) return {};
  try {
    const rows = await externalDb.listClientQueueAccess(cid);
    const out: Record<string, string[] | null> = {};
    for (const r of rows ?? []) {
      out[String(r.user_id)] = r.queue_access === 'specific' ? (r.queue_ids ?? []).map(String) : null;
    }
    return out;
  } catch (err) {
    console.warn('[capacity] allowlist de filas indisponível:', err);
    return {};
  }
}

export async function fetchCapacity(
  clientId: string | number | null | undefined,
  identifier: string | number | null | undefined,
): Promise<CapacityInfo | null> {
  const cid = clientId != null ? String(clientId) : '';
  const id = identifier != null ? String(identifier) : '';
  if (!cid || !id) return null;
  const access = await fetchQueueAccessMap(cid);
  const { data, error } = await supabase.rpc('chat_capacity_check' as never, {
    p_client_id: cid,
    p_agent_identifier: id,
    p_allowed_queues: access[id] ?? null,
  } as never);
  if (error) throw error;
  const raw = data as unknown;
  const row = (Array.isArray(raw) ? raw[0] : raw) as
    | { agent_name: string | null; load: number; max_concurrent: number | null; enforced?: boolean }
    | null;
  const load = Number(row?.load) || 0;
  const enforced = row?.enforced === true && Number(row?.max_concurrent) > 0;
  const max = enforced ? Number(row?.max_concurrent) : null;
  return {
    identifier: id,
    name: row?.agent_name ?? null,
    load,
    max_concurrent: max,
    blocked: max != null && load >= max,
    slots: max == null ? null : Math.max(0, max - load),
    enforced,
  };
}

/**
 * Garante que o atendente tem vaga. Lança CapacityBlockedError se estourou.
 * Em caso de erro de rede/RPC, libera (fail-open) para não travar o atendimento.
 */
export async function assertCapacity(
  clientId: string | number | null | undefined,
  identifier: string | number | null | undefined,
  fallbackName?: string | null,
): Promise<void> {
  let info: CapacityInfo | null = null;
  try {
    info = await fetchCapacity(clientId, identifier);
  } catch (err) {
    console.warn('[capacity] verificação falhou, liberando:', err);
    return;
  }
  if (!info) return;
  if (info.enforced && info.blocked) {
    throw new CapacityBlockedError({ ...info, name: info.name || fallbackName || null });
  }
}

export interface LiveLoadBreakdown {
  /** Carga que conta (filas visíveis, em atendimento, sem snooze). */
  load: number;
  /** Conversas atribuídas em filas que o atendente não enxerga. */
  outOfScope: number;
}

/** Carga real de todos os atendentes do escritório, com composição. */
export async function fetchLiveLoadsDetailed(
  clientId: string | number | null | undefined,
): Promise<Record<string, LiveLoadBreakdown>> {
  const cid = clientId != null ? String(clientId) : '';
  if (!cid) return {};
  const [{ data, error }, access] = await Promise.all([
    supabase.rpc('chat_agent_load_by_queue' as never, { p_client_id: cid } as never),
    fetchQueueAccessMap(cid),
  ]);
  if (error) throw error;
  const out: Record<string, LiveLoadBreakdown> = {};
  for (const row of ((data ?? []) as Array<{ agent_identifier: string; queue_id: string | null; load: number }>)) {
    const id = String(row.agent_identifier);
    const n = Number(row.load) || 0;
    const allowed = access[id] ?? null;
    const qid = row.queue_id ? String(row.queue_id) : null;
    const visible = !allowed || !qid || allowed.includes(qid);
    const cur = out[id] ?? { load: 0, outOfScope: 0 };
    if (visible) cur.load += n;
    else cur.outOfScope += n;
    out[id] = cur;
  }
  return out;
}

/** Carga real de todos os atendentes do escritório. */
export async function fetchLiveLoads(
  clientId: string | number | null | undefined,
): Promise<Record<string, number>> {
  const detailed = await fetchLiveLoadsDetailed(clientId);
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(detailed)) out[id] = v.load;
  return out;
}
