/**
 * Capacidade de atendentes (front) — usa a MESMA regra do servidor, via RPC
 * no banco (`chat_capacity_check` / `chat_agent_live_load`). A UI nunca
 * recalcula limite localmente.
 */
import { supabase } from '@/integrations/supabase/client';

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

export async function fetchCapacity(
  clientId: string | number | null | undefined,
  identifier: string | number | null | undefined,
): Promise<CapacityInfo | null> {
  const cid = clientId != null ? String(clientId) : '';
  const id = identifier != null ? String(identifier) : '';
  if (!cid || !id) return null;
  const { data, error } = await supabase.rpc('chat_capacity_check' as never, {
    p_client_id: cid,
    p_agent_identifier: id,
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

/** Carga real de todos os atendentes do escritório. */
export async function fetchLiveLoads(
  clientId: string | number | null | undefined,
): Promise<Record<string, number>> {
  const cid = clientId != null ? String(clientId) : '';
  if (!cid) return {};
  const { data, error } = await supabase.rpc('chat_agent_live_load' as never, { p_client_id: cid } as never);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of ((data ?? []) as Array<{ agent_identifier: string; load: number }>)) {
    out[String(row.agent_identifier)] = Number(row.load) || 0;
  }
  return out;
}
