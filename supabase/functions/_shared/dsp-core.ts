// ============================================================
// Módulo de Disparos — núcleo compartilhado (limites, rotação, elegibilidade)
//
// Aqui vivem TODAS as regras anti-bloqueio. O worker nunca envia nada sem
// passar por `pickChannelForSend`, que aplica: limites por minuto/hora/dia,
// destinatários únicos, intervalo mínimo/máximo com jitter, blocos + pausa,
// rampa diária, janela de horário/dias e cooldown do circuit breaker.
// ============================================================

export const DSP_OPTOUT_PATTERNS = [
  'sair', 'parar', 'pare', 'cancelar', 'remover', 'descadastrar',
  'nao quero', 'não quero', 'stop', 'unsubscribe',
];

/** Normaliza telefone para o canônico BR (55 + DDD + número). */
export function toE164Br(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/@.*/, '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  if (d.startsWith('0') && (d.length === 11 || d.length === 12)) return '55' + d.slice(1);
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
}

export function phoneVariants(canonical: string): string[] {
  const d = (canonical || '').replace(/\D/g, '');
  if (!d) return [];
  const out = new Set<string>([d]);
  if (d.startsWith('55')) {
    const ddd = d.slice(2, 4);
    if (d.length === 13 && d[4] === '9') out.add(`55${ddd}${d.slice(5)}`);
    else if (d.length === 12 && /[6-9]/.test(d[4] ?? '')) out.add(`55${ddd}9${d.slice(4)}`);
  }
  return [...out];
}

export function isValidBrPhone(canonical: string): boolean {
  const d = (canonical || '').replace(/\D/g, '');
  return d.startsWith('55') && (d.length === 12 || d.length === 13);
}

export function randomInt(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

export interface DspLimits {
  queue_id: string;
  provider: string | null;
  is_enabled?: boolean;
  default_weight?: number;
  max_per_minute: number;
  max_per_hour: number;
  max_per_day: number;
  max_unique_recipients_per_day: number;
  min_seconds_between_messages: number;
  max_seconds_between_messages: number;
  block_size: number;
  block_pause_seconds: number;
  daily_ramp_percent: number;
  max_consecutive_failures: number;
  cooldown_after_disconnect_minutes: number;
  marketing_enabled: boolean;
  send_window_start: string | null;
  send_window_end: string | null;
}


/** Defaults conservadores para instância não oficial (UaZapi). */
export const DSP_DEFAULT_LIMITS: Omit<DspLimits, 'queue_id' | 'provider'> = {
  max_per_minute: 6,
  max_per_hour: 120,
  max_per_day: 400,
  max_unique_recipients_per_day: 400,
  min_seconds_between_messages: 8,
  max_seconds_between_messages: 25,
  block_size: 20,
  block_pause_seconds: 300,
  daily_ramp_percent: 30,
  max_consecutive_failures: 5,
  cooldown_after_disconnect_minutes: 60,
  marketing_enabled: false,
  send_window_start: '08:00',
  send_window_end: '20:00',
};

/** Limites mais folgados para API Oficial (a Meta já controla capacidade). */
export const DSP_OFFICIAL_LIMITS: Omit<DspLimits, 'queue_id' | 'provider'> = {
  ...DSP_DEFAULT_LIMITS,
  max_per_minute: 60,
  max_per_hour: 1000,
  max_per_day: 5000,
  max_unique_recipients_per_day: 5000,
  min_seconds_between_messages: 1,
  max_seconds_between_messages: 3,
  block_size: 200,
  block_pause_seconds: 30,
  marketing_enabled: true,
};

export function isUazapi(queue: { channel_type?: string | null; hub?: string | null }): boolean {
  const v = `${queue?.hub ?? ''}${queue?.channel_type ?? ''}`.toLowerCase();
  return v.includes('uazapi') || v.includes('evo');
}

/** Hora/minuto em Brasília (o produto opera em BRT). */
export function brtNow(now = new Date()) {
  const brt = new Date(now.getTime() - 3 * 3600_000);
  return {
    date: brt.toISOString().slice(0, 10),
    minutes: brt.getUTCHours() * 60 + brt.getUTCMinutes(),
    weekDay: brt.getUTCDay(), // 0 = domingo
  };
}

function hhmmToMinutes(v: string | null | undefined): number | null {
  if (!v) return null;
  const [h, m] = String(v).split(':');
  const hh = Number(h), mm = Number(m ?? 0);
  if (!Number.isFinite(hh)) return null;
  return hh * 60 + mm;
}

export function insideWindow(
  start: string | null | undefined,
  end: string | null | undefined,
  weekDays: number[] | null | undefined,
  now = new Date(),
): boolean {
  const { minutes, weekDay } = brtNow(now);
  if (weekDays && weekDays.length > 0 && !weekDays.includes(weekDay)) return false;
  const s = hhmmToMinutes(start), e = hhmmToMinutes(end);
  if (s == null || e == null) return true;
  return s <= e ? minutes >= s && minutes <= e : minutes >= s || minutes <= e;
}

export interface DspChannelState {
  queue_id: string;
  window_minute: string | null;
  sent_in_minute: number;
  window_hour: string | null;
  sent_in_hour: number;
  window_day: string | null;
  sent_in_day: number;
  unique_recipients_day: number;
  allowed_today: number | null;
  block_count: number;
  consecutive_failures: number;
  last_sent_at: string | null;
  next_allowed_at: string | null;
  cooldown_until: string | null;
  cooldown_reason: string | null;
  health_status: string;
}

export interface ChannelCandidate {
  queue: any;
  limits: DspLimits;
  state: DspChannelState;
}

export interface ChannelDecision {
  ok: boolean;
  reason?: string;
  candidate?: ChannelCandidate;
}

const DSP_LIMIT_FIELDS = [
  'max_per_minute', 'max_per_hour', 'max_per_day', 'max_unique_recipients_per_day',
  'min_seconds_between_messages', 'max_seconds_between_messages', 'block_size',
  'block_pause_seconds', 'daily_ramp_percent', 'max_consecutive_failures',
  'cooldown_after_disconnect_minutes', 'marketing_enabled',
  'send_window_start', 'send_window_end',
] as const;

/**
 * Padrões seguros do escritório por tipo de API (aba Configurações do módulo).
 * Cache por execução para não repetir a leitura em cada fila do lote.
 */
const providerDefaultsCache = new Map<string, any>();

export async function loadProviderDefaults(admin: any, clientId: string, provider: string) {
  const key = `${clientId}:${provider}`;
  if (providerDefaultsCache.has(key)) return providerDefaultsCache.get(key);

  const base = provider === 'uazapi' ? DSP_DEFAULT_LIMITS : DSP_OFFICIAL_LIMITS;

  const { data } = await admin
    .from('dsp_provider_defaults').select('*')
    .eq('client_id', String(clientId)).eq('provider', provider).maybeSingle();

  let row = data;
  if (!row) {
    const insert = { ...base, client_id: String(clientId), provider };
    const { data: created } = await admin
      .from('dsp_provider_defaults').insert(insert).select('*').maybeSingle();
    row = created ?? insert;
  }

  providerDefaultsCache.set(key, row);
  return row;
}

/** Carrega o vínculo do canal + estado, com limites herdados do perfil do provider. */
export async function loadChannel(admin: any, queue: any): Promise<ChannelCandidate> {
  const provider = isUazapi(queue) ? 'uazapi' : 'meta_cloud';
  const clientId = String(queue.client_id);
  const defaults = await loadProviderDefaults(admin, clientId, provider);

  // dsp_channel_limits agora é só o registro de vínculo (is_enabled / default_weight).
  let { data: link } = await admin
    .from('dsp_channel_limits').select('*').eq('queue_id', queue.id).maybeSingle();

  if (!link) {
    // Fila nova precisa ser habilitada explicitamente na aba "Canais".
    const insert = { queue_id: queue.id, client_id: clientId, provider, is_enabled: false, default_weight: 1 };
    const { data } = await admin.from('dsp_channel_limits').insert(insert).select('*').maybeSingle();
    link = data ?? { ...insert, id: null };
  }

  const limits: any = { queue_id: queue.id, provider, is_enabled: link.is_enabled === true, default_weight: Number(link.default_weight ?? 1) };
  for (const f of DSP_LIMIT_FIELDS) limits[f] = defaults[f];

  let { data: state } = await admin
    .from('dsp_channel_state').select('*').eq('queue_id', queue.id).maybeSingle();

  if (!state) {
    const { data } = await admin
      .from('dsp_channel_state')
      .insert({ queue_id: queue.id, client_id: clientId })
      .select('*').maybeSingle();
    state = data;
  }

  return { queue, limits: limits as DspLimits, state: state as DspChannelState };
}


/** Reseta contadores de janelas expiradas (não persiste; devolve estado ajustado). */
export function rollWindows(state: DspChannelState, now = new Date()): DspChannelState {
  const s = { ...state };
  const minuteKey = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();
  const hourKey = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000).toISOString();
  const dayKey = brtNow(now).date;

  if (s.window_minute !== minuteKey) { s.window_minute = minuteKey; s.sent_in_minute = 0; }
  if (s.window_hour !== hourKey) { s.window_hour = hourKey; s.sent_in_hour = 0; }
  if (s.window_day !== dayKey) {
    s.window_day = dayKey;
    s.sent_in_day = 0;
    s.unique_recipients_day = 0;
    s.block_count = 0;
  }
  return s;
}

/** Limite diário efetivo, com rampa sobre o volume do dia anterior. */
export function effectiveDailyLimit(limits: DspLimits, state: DspChannelState): number {
  const ramp = Number(limits.daily_ramp_percent ?? 0);
  if (!state.allowed_today || ramp <= 0) return limits.max_per_day;
  return Math.min(limits.max_per_day, Math.max(20, Math.ceil(state.allowed_today)));
}

/** Aplica todas as regras de segurança e devolve se a fila pode enviar agora. */
export function canSendNow(c: ChannelCandidate, opts: { category?: string } = {}, now = new Date()): ChannelDecision {
  const { limits } = c;
  const state = rollWindows(c.state, now);

  if (c.queue?.is_active === false || c.queue?.is_deleted) return { ok: false, reason: 'queue_inactive' };
  if (limits.is_enabled === false) return { ok: false, reason: 'channel_not_enabled' };

  if (state.cooldown_until && new Date(state.cooldown_until) > now) {
    return { ok: false, reason: `cooldown:${state.cooldown_reason ?? 'unknown'}` };
  }
  if (state.health_status === 'blocked') return { ok: false, reason: 'channel_blocked' };
  if (opts.category === 'marketing' && !limits.marketing_enabled) {
    return { ok: false, reason: 'marketing_disabled_on_channel' };
  }
  if (!insideWindow(limits.send_window_start, limits.send_window_end, null, now)) {
    return { ok: false, reason: 'outside_channel_window' };
  }
  if (state.next_allowed_at && new Date(state.next_allowed_at) > now) {
    return { ok: false, reason: 'throttled' };
  }
  if (state.sent_in_minute >= limits.max_per_minute) return { ok: false, reason: 'minute_limit' };
  if (state.sent_in_hour >= limits.max_per_hour) return { ok: false, reason: 'hour_limit' };
  if (state.sent_in_day >= effectiveDailyLimit(limits, state)) return { ok: false, reason: 'day_limit' };
  if (state.unique_recipients_day >= limits.max_unique_recipients_per_day) {
    return { ok: false, reason: 'unique_recipients_limit' };
  }

  return { ok: true, candidate: { ...c, state } };
}

/**
 * Round-robin entre candidatos elegíveis: escolhe quem enviou há mais tempo,
 * respeitando o peso configurado da fila na campanha.
 */
export function pickChannel(
  candidates: ChannelCandidate[],
  weights: Record<string, number>,
  opts: { category?: string } = {},
  now = new Date(),
): { candidate?: ChannelCandidate; reasons: Record<string, string> } {
  const reasons: Record<string, string> = {};
  const eligible: ChannelCandidate[] = [];

  for (const c of candidates) {
    const d = canSendNow(c, opts, now);
    if (d.ok && d.candidate) eligible.push(d.candidate);
    else reasons[c.queue.id] = d.reason ?? 'unknown';
  }
  if (eligible.length === 0) return { reasons };

  eligible.sort((a, b) => {
    const wa = weights[a.queue.id] ?? Number(a.limits.default_weight ?? 1) ?? 1;
    const wb = weights[b.queue.id] ?? Number(b.limits.default_weight ?? 1) ?? 1;

    const usageA = (a.state.sent_in_day + 1) / Math.max(1, wa);
    const usageB = (b.state.sent_in_day + 1) / Math.max(1, wb);
    if (usageA !== usageB) return usageA - usageB;
    const ta = a.state.last_sent_at ? new Date(a.state.last_sent_at).getTime() : 0;
    const tb = b.state.last_sent_at ? new Date(b.state.last_sent_at).getTime() : 0;
    return ta - tb;
  });

  return { candidate: eligible[0], reasons };
}

/**
 * Grava o consumo após um envio: contadores, próximo horário permitido
 * (intervalo com jitter) e pausa entre blocos.
 */
export async function commitSend(admin: any, c: ChannelCandidate, now = new Date()): Promise<void> {
  const state = rollWindows(c.state, now);
  const limits = c.limits;

  const sentInDay = state.sent_in_day + 1;
  const blockCount = state.block_count + 1;
  const endOfBlock = limits.block_size > 0 && blockCount % limits.block_size === 0;

  const gap = endOfBlock
    ? randomInt(limits.block_pause_seconds, Math.ceil(limits.block_pause_seconds * 1.35))
    : randomInt(limits.min_seconds_between_messages, Math.max(limits.min_seconds_between_messages, limits.max_seconds_between_messages));

  await admin.from('dsp_channel_state').update({
    window_minute: state.window_minute,
    sent_in_minute: state.sent_in_minute + 1,
    window_hour: state.window_hour,
    sent_in_hour: state.sent_in_hour + 1,
    window_day: state.window_day,
    sent_in_day: sentInDay,
    unique_recipients_day: state.unique_recipients_day + 1,
    allowed_today: state.allowed_today
      ?? Math.min(limits.max_per_day, Math.ceil(limits.max_per_day * (limits.daily_ramp_percent / 100) || limits.max_per_day)),
    block_count: blockCount,
    consecutive_failures: 0,
    last_sent_at: now.toISOString(),
    next_allowed_at: new Date(now.getTime() + gap * 1000).toISOString(),
    health_status: 'healthy',
    updated_at: now.toISOString(),
  }).eq('queue_id', c.queue.id);
}

/** Circuit breaker: registra falha e coloca a fila em cooldown se estourar o limite. */
export async function registerFailure(
  admin: any,
  c: ChannelCandidate,
  reason: string,
  opts: { hardStop?: boolean } = {},
): Promise<{ tripped: boolean }> {
  const failures = (c.state.consecutive_failures ?? 0) + 1;
  const tripped = opts.hardStop === true || failures >= c.limits.max_consecutive_failures;
  const cooldownMinutes = c.limits.cooldown_after_disconnect_minutes || 60;

  await admin.from('dsp_channel_state').update({
    consecutive_failures: failures,
    health_status: tripped ? 'blocked' : 'degraded',
    cooldown_until: tripped ? new Date(Date.now() + cooldownMinutes * 60_000).toISOString() : c.state.cooldown_until,
    cooldown_reason: tripped ? reason : c.state.cooldown_reason,
    updated_at: new Date().toISOString(),
  }).eq('queue_id', c.queue.id);

  return { tripped };
}

/** Falha permanente do provedor → não retentar. */
export function isPermanentError(msg: string): boolean {
  const m = (msg || '').toLowerCase();
  return [
    'not a whatsapp', 'invalid number', 'number not found', 'no whatsapp',
    'template', 'not exists', 'invalid recipient', 'unsupported',
  ].some((k) => m.includes(k));
}

/** Detecta desconexão / necessidade de novo QR → pausa dura. */
export function isDisconnectionError(msg: string): boolean {
  const m = (msg || '').toLowerCase();
  return ['disconnected', 'not connected', 'qrcode', 'qr code', 'logged out', 'unauthorized', 'invalid token', 'close']
    .some((k) => m.includes(k));
}

export function hasOptoutIntent(text: string | null | undefined): boolean {
  const t = String(text ?? '').toLowerCase().trim();
  if (!t || t.length > 40) return false;
  return DSP_OPTOUT_PATTERNS.some((p) => t === p || t.startsWith(p + ' ') || t === p + '!' || t === p + '.');
}

/** Substitui {{variavel}} / {nome} pelo valor do destinatário. */
export function renderTemplate(text: string, vars: Record<string, unknown>): string {
  return String(text ?? '')
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => String(vars?.[k] ?? ''))
    .replace(/\{\s*([\w.]+)\s*\}/g, (_m, k) => (k in (vars ?? {}) ? String(vars[k] ?? '') : `{${k}}`));
}

/** Sorteia variante por peso (rotação de mensagem). */
export function pickVariant<T extends { id: string; weight?: number; is_active?: boolean }>(variants: T[]): T | null {
  const active = variants.filter((v) => v.is_active !== false);
  if (active.length === 0) return null;
  const total = active.reduce((s, v) => s + Math.max(1, v.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const v of active) {
    r -= Math.max(1, v.weight ?? 1);
    if (r <= 0) return v;
  }
  return active[active.length - 1];
}
