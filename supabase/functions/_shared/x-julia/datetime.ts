// ============================================
// X-Julia — data/hora em America/Sao_Paulo (offset fixo -03:00)
// Todo cálculo de data do agente passa por aqui (nunca pelo modelo).
// ============================================

const TZ = "America/Sao_Paulo";
const OFFSET_MS = 3 * 60 * 60 * 1000;

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

/** Data "deslocada" para BRT: os getters UTC devolvem os componentes locais de São Paulo. */
function toShifted(date: Date): Date {
  return new Date(date.getTime() - OFFSET_MS);
}

function fromShifted(shifted: Date): Date {
  return new Date(shifted.getTime() + OFFSET_MS);
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

export function nowBRT(): Date {
  return new Date();
}

/** dd/MM/yyyy */
export function formatDateBRT(date: Date): string {
  const s = toShifted(date);
  return `${pad(s.getUTCDate())}/${pad(s.getUTCMonth() + 1)}/${s.getUTCFullYear()}`;
}

/** HH:mm */
export function formatTimeBRT(date: Date): string {
  const s = toShifted(date);
  return `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}`;
}

/** dd/MM/yyyy HH:mm */
export function formatBRT(date: Date): string {
  return `${formatDateBRT(date)} ${formatTimeBRT(date)}`;
}

export function weekdayBRT(date: Date): string {
  return WEEKDAYS[toShifted(date).getUTCDay()];
}

/** segunda-feira, 09/08/2026 11:29 */
export function formatFullBRT(date: Date): string {
  return `${weekdayBRT(date)}, ${formatBRT(date)}`;
}

/** ISO 8601 com fuso explícito -03:00 (nunca sem fuso). */
export function isoBRT(date: Date): string {
  const s = toShifted(date);
  return (
    `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}` +
    `T${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}:${pad(s.getUTCSeconds())}` +
    `.${pad(s.getUTCMilliseconds(), 3)}-03:00`
  );
}

/** Meia-noite (BRT) do dia da data informada, com deslocamento em dias. */
export function startOfDayBRT(date: Date, addDays = 0): Date {
  const s = toShifted(date);
  s.setUTCDate(s.getUTCDate() + addDays);
  s.setUTCHours(0, 0, 0, 0);
  return fromShifted(s);
}

export function addDaysBRT(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Diferença em dias de calendário (BRT) entre duas datas. */
export function diffCalendarDaysBRT(target: Date, base: Date): number {
  const a = startOfDayBRT(target).getTime();
  const b = startOfDayBRT(base).getTime();
  return Math.round((a - b) / 86_400_000);
}

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const WEEKDAY_KEYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

export interface ResolvedDate {
  date: Date;
  expression: string;
  matched: boolean;
}

/**
 * Resolve expressões relativas em pt-BR sobre o "agora" de Brasília.
 * Suporta: hoje, amanhã, depois de amanhã, ontem, hoje+3d, +2 semanas,
 * proxima segunda, fim do mes, dd/MM[/yyyy] e ISO.
 */
export function resolveExpression(expression?: string | null, base = nowBRT()): ResolvedDate {
  const raw = String(expression ?? "").trim();
  if (!raw) return { date: base, expression: "agora", matched: true };

  const e = stripAccents(raw.toLowerCase()).replace(/\s+/g, " ").trim();

  if (e === "agora" || e === "hoje") return { date: base, expression: raw, matched: true };
  if (e === "amanha") return { date: addDaysBRT(base, 1), expression: raw, matched: true };
  if (e === "depois de amanha") return { date: addDaysBRT(base, 2), expression: raw, matched: true };
  if (e === "ontem") return { date: addDaysBRT(base, -1), expression: raw, matched: true };

  // hoje+3d | +3d | -2 dias | +2 semanas | +1 mes
  const rel = e.match(/^(?:hoje|agora)?\s*([+-])\s*(\d{1,3})\s*(d|dias?|semanas?|meses|mes|h|horas?)$/);
  if (rel) {
    const sign = rel[1] === "-" ? -1 : 1;
    const qty = Number(rel[2]) * sign;
    const unit = rel[3];
    if (unit.startsWith("h")) return { date: new Date(base.getTime() + qty * 3_600_000), expression: raw, matched: true };
    if (unit.startsWith("semana")) return { date: addDaysBRT(base, qty * 7), expression: raw, matched: true };
    if (unit.startsWith("mes") || unit === "meses") {
      const s = toShifted(base);
      s.setUTCMonth(s.getUTCMonth() + qty);
      return { date: fromShifted(s), expression: raw, matched: true };
    }
    return { date: addDaysBRT(base, qty), expression: raw, matched: true };
  }

  // proxima segunda | segunda que vem | na sexta
  const wd = e.match(/(?:proxima?|proximo|que vem|na|no)?\s*(domingo|segunda|terca|quarta|quinta|sexta|sabado)/);
  if (wd) {
    const target = WEEKDAY_KEYS[wd[1]];
    const current = toShifted(base).getUTCDay();
    let delta = (target - current + 7) % 7;
    if (delta === 0) delta = 7;
    const day = startOfDayBRT(base, delta);
    return { date: new Date(day.getTime() + 9 * 3_600_000), expression: raw, matched: true };
  }

  if (e === "fim do mes" || e === "final do mes") {
    const s = toShifted(base);
    s.setUTCMonth(s.getUTCMonth() + 1, 0);
    s.setUTCHours(23, 59, 0, 0);
    return { date: fromShifted(s), expression: raw, matched: true };
  }

  // dd/MM[/yyyy] [HH:mm]
  const br = e.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (br) {
    const nowShifted = toShifted(base);
    let year = br[3] ? Number(br[3]) : nowShifted.getUTCFullYear();
    if (year < 100) year += 2000;
    const d = new Date(
      Date.UTC(year, Number(br[2]) - 1, Number(br[1]), Number(br[4] ?? 9), Number(br[5] ?? 0), 0, 0),
    );
    return { date: fromShifted(d), expression: raw, matched: true };
  }

  // ISO (com ou sem fuso — sem fuso é lido como BRT)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const hasTz = /(Z|[+-]\d{2}:?\d{2})$/.test(raw.trim());
    if (hasTz) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return { date: parsed, expression: raw, matched: true };
    }
    const d = new Date(
      Date.UTC(
        Number(iso[1]),
        Number(iso[2]) - 1,
        Number(iso[3]),
        Number(iso[4] ?? 9),
        Number(iso[5] ?? 0),
        Number(iso[6] ?? 0),
      ),
    );
    return { date: fromShifted(d), expression: raw, matched: true };
  }

  return { date: base, expression: raw, matched: false };
}

/** Bloco de âncora temporal injetado no prompt do agente. */
export function buildTimeAnchor(now = nowBRT()): string {
  const lines = [
    `Data e hora AGORA: ${formatFullBRT(now)} (fuso ${TZ}, UTC-03:00).`,
    `Hoje é ${weekdayBRT(now)}, ${formatDateBRT(now)}. ` +
      `Amanhã é ${weekdayBRT(addDaysBRT(now, 1))}, ${formatDateBRT(addDaysBRT(now, 1))}. ` +
      `Depois de amanhã é ${weekdayBRT(addDaysBRT(now, 2))}, ${formatDateBRT(addDaysBRT(now, 2))}.`,
    `Nunca suponha a data ou o horário: use esta âncora ou a skill data_hora para qualquer cálculo ` +
      `(prazos, "em 3 dias", "próxima segunda", datas de agendamento).`,
    `Ao falar de datas com o lead, diga o dia da semana e a data (ex.: "quinta-feira, ${formatDateBRT(addDaysBRT(now, 2))}").`,
  ];
  return lines.join("\n");
}