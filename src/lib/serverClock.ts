import { supabase } from '@/integrations/supabase/client';

// Skew em milissegundos: serverEpoch - Date.now() no momento da sincronização.
let skewMs = 0;
let lastSyncAt = 0;
let inflight: Promise<void> | null = null;

const RESYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 min

function parseBrtIsoToEpoch(iso: string): number {
  // Formato esperado: 2026-05-22T11:43:07.812-03:00
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

async function syncSkew(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const t0 = Date.now();
      const { data, error } = await supabase.rpc('server_now_brt');
      const t1 = Date.now();
      if (error || typeof data !== 'string') return;
      const serverEpoch = parseBrtIsoToEpoch(data);
      if (!Number.isFinite(serverEpoch)) return;
      // Compensa metade do RTT (estimativa simples)
      const midClient = (t0 + t1) / 2;
      skewMs = Math.round(serverEpoch - midClient);
      lastSyncAt = Date.now();
    } catch {
      // mantém skew anterior em caso de falha
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Garante que o skew esteja sincronizado; dispara re-sync em background
 * quando expirado. Não bloqueia o caller.
 */
export function ensureServerClock(): void {
  if (lastSyncAt === 0 || Date.now() - lastSyncAt > RESYNC_INTERVAL_MS) {
    void syncSkew();
  }
}

/**
 * Retorna o "agora" do servidor formatado como ISO 8601 no fuso de Brasília
 * (UTC-3), ex.: `2026-05-22T11:43:07.812-03:00`.
 *
 * Usa o skew em cache calculado a partir de `public.server_now_brt()`.
 * Se ainda não houver skew sincronizado, dispara o sync em background e
 * retorna o relógio local convertido para -03:00.
 */
export function getServerNowBRT(): string {
  ensureServerClock();
  const epoch = Date.now() + skewMs;
  return formatEpochAsBRT(epoch);
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

function formatEpochAsBRT(epoch: number): string {
  // -03:00 fixo (sem horário de verão no Brasil desde 2019)
  const brt = new Date(epoch - 3 * 60 * 60 * 1000);
  const yyyy = brt.getUTCFullYear();
  const mm = pad(brt.getUTCMonth() + 1);
  const dd = pad(brt.getUTCDate());
  const hh = pad(brt.getUTCHours());
  const mi = pad(brt.getUTCMinutes());
  const ss = pad(brt.getUTCSeconds());
  const ms = pad(brt.getUTCMilliseconds(), 3);
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}-03:00`;
}